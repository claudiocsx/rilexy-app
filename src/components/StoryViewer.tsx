import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
  AccessibilityInfo,
  TextInput,
  ActivityIndicator,
  FlatList,
  Keyboard,
  Platform,
  Alert,
  Pressable,
  PanResponder,
} from 'react-native';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { StoryGroup, markViewed, deleteStory } from '../services/stories';
import { findOrCreateChat } from '../services/chat';
import { updateChatLastMessage } from '../services/chatNotifications';
import { db } from '../services/firebase';
import { getColors } from '../theme/colors';
import { useSettingsStore } from '../store/settingsStore';
import { useToast } from '../components/Toast';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STORY_DURATION = 5000;
const PROGRESS_BAR_HEIGHT = 2;
const REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];

interface Props {
  visible: boolean;
  groups: StoryGroup[];
  startIndex: number;
  onClose: () => void;
  currentUserId?: string;
}

function isLightColor(hex?: string): boolean {
  if (!hex) return false;
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 155;
}

export default function StoryViewer({ visible, groups, startIndex, onClose, currentUserId }: Props) {
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { showToast } = useToast();
  const theme = useSettingsStore((s) => s.theme);
  const c = getColors(theme);
  const styles = useMemo(() => getStyles(c), [c]);
  const [groupIdx, setGroupIdx] = useState(startIndex);
  const [storyIdx, setStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const viewedRef = useRef<Set<string>>(new Set());
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [viewers, setViewers] = useState<{ uid: string; name: string; photoURL?: string }[]>([]);
  const [viewersLoading, setViewersLoading] = useState(false);
  const [reactionSending, setReactionSending] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const pausedRef = useRef(false);
  const elapsedRef = useRef(0);
  const tickStartRef = useRef(0);
  const pressStartRef = useRef(0);
  const videoSubRef = useRef<{ remove: () => void } | null>(null);
  const [floatEmoji, setFloatEmoji] = useState<string | null>(null);
  const floatAnim = useRef(new Animated.Value(0)).current;
  const swipeTranslateY = useRef(new Animated.Value(0)).current;
  const swipeOpacity = useRef(new Animated.Value(1)).current;

  const swipePanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 10,
      onPanResponderGrant: () => {
        pausedRef.current = true;
      },
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) {
          swipeTranslateY.setValue(gs.dy);
          swipeOpacity.setValue(Math.max(1 - gs.dy / 300, 0.3));
        }
      },
      onPanResponderRelease: (_, gs) => {
        pausedRef.current = false;
        tickStartRef.current = Date.now();
        if (gs.dy > 120) {
          onClose();
        } else {
          Animated.parallel([
            Animated.spring(swipeTranslateY, { toValue: 0, useNativeDriver: true }),
            Animated.timing(swipeOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
          ]).start();
        }
      },
    })
  ).current;

  const currentGroup = groups[groupIdx];
  const currentStories = currentGroup?.stories || [];
  const currentStory = currentStories[storyIdx];
  const isOwn = currentUserId && currentGroup?.userId === currentUserId;
  const videoSource = currentStory?.mediaType === 'video' && currentStory?.mediaUrl ? currentStory.mediaUrl : null;
  const videoPlayer = useVideoPlayer(videoSource, (player) => {
    player.loop = false;
  });

  useEffect(() => {
    setGroupIdx(startIndex);
    setStoryIdx(0);
    setProgress(0);
    viewedRef.current = new Set();
    setReplyText('');
    setShowViewers(false);
    setViewers([]);
  }, [startIndex, visible]);

  useEffect(() => {
    if (!isOwn || !currentStory?.id) { setViewers([]); return; }
    const v = currentStory.viewedBy || [];
    if (v.length === 0) { setViewers([]); return; }
    setViewersLoading(true);
    Promise.all(
      v.map(async (uid) => {
        try {
          const doc = await db.collection('users').doc(uid).get();
          const data = doc.data();
          return { uid, name: data?.displayName || uid, photoURL: data?.photoURL || undefined };
        } catch { return { uid, name: uid }; }
      })
    ).then(setViewers).finally(() => setViewersLoading(false));
  }, [currentStory?.id, isOwn]);

  useEffect(() => {
    const wasPaused = pausedRef.current;
    pausedRef.current = showViewers || replying || inputFocused;
    if (pausedRef.current && !wasPaused && currentStory?.mediaType === 'video') {
      try { videoPlayer.pause(); } catch {}
    } else if (!pausedRef.current && wasPaused && currentStory?.mediaType === 'video') {
      try { videoPlayer.play(); } catch {}
    }
    if (!pausedRef.current && tickStartRef.current > 0) {
      tickStartRef.current = Date.now();
    }
  }, [showViewers, replying, inputFocused]);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => setKeyboardHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const showFloatingEmoji = (emoji: string) => {
    setFloatEmoji(emoji);
    floatAnim.setValue(0);
    Animated.parallel([
      Animated.timing(floatAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setFloatEmoji(null);
    });
  };

  const handleReaction = async (emoji: string) => {
    if (!user || !currentGroup || reactionSending) return;
    showFloatingEmoji(emoji);
    setReactionSending(true);
    try {
      const chatId = await findOrCreateChat(user.uid, currentGroup.userId, currentGroup.userName);
      await db.collection('chats').doc(chatId).collection('messages').add({
        text: emoji,
        senderId: user.uid,
        participants: [user.uid, currentGroup.userId],
        readBy: [user.uid],
        timestamp: new Date(),
        storyContext: {
          type: 'reaction',
          emoji,
          preview: {
            mediaUrl: currentStory.mediaUrl,
            mediaType: currentStory.mediaType,
            text: currentStory.text,
            bgColor: currentStory.bgColor,
          },
        },
        storyAuthorId: currentGroup.userId,
        storyAuthorName: currentGroup.userName,
      });
      updateChatLastMessage(chatId, emoji, user.uid);
      onClose();
      navigation.navigate('Chat', { chatId, name: currentGroup.userName, photoURL: currentGroup.photoURL });
    } catch { /* silence */ } finally {
      setReactionSending(false);
    }
  };

  const reduceMotionRef = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((e) => { reduceMotionRef.current = e; });
  }, []);

  useEffect(() => {
    if (!visible || !currentStory) return;

    fadeAnim.setValue(0);
    scaleAnim.setValue(0.8);
    pulseAnim.setValue(1);

    if (!reduceMotionRef.current) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    } else {
      fadeAnim.setValue(1);
      scaleAnim.setValue(1);
    }

    if (pulseRef.current) pulseRef.current.stop();
    const tempTimer: { current: ReturnType<typeof setTimeout> | null } = { current: null };

    if (!reduceMotionRef.current) {
      pulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.04, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      );
      pulseRef.current.start();

      tempTimer.current = setTimeout(() => {
        if (pulseRef.current) pulseRef.current.stop();
      }, 10000);
    }

    if (currentStory.id && user && !viewedRef.current.has(currentStory.id)) {
      viewedRef.current.add(currentStory.id);
      markViewed(currentStory.id, user.uid).catch(() => {});
    }

    const isVideo = currentStory?.mediaType === 'video';
    const hasSegment = isVideo && currentStory?.videoSegmentEnd != null;
    if (isVideo) {
      try { videoPlayer.play(); } catch {}
      if (hasSegment && currentStory?.videoSegmentStart != null) {
        try { videoPlayer.currentTime = currentStory.videoSegmentStart; } catch {}
      }
      if (!hasSegment) {
        const sub = videoPlayer.addListener('playToEnd', goNext);
        videoSubRef.current = sub;
      }
      elapsedRef.current = 0;
      tickStartRef.current = Date.now();
      timerRef.current = setInterval(() => {
        if (pausedRef.current || currentStory?.mediaType !== 'video') {
          tickStartRef.current = Date.now();
          return;
        }
        try {
          if (hasSegment && currentStory?.videoSegmentEnd != null && currentStory?.videoSegmentStart != null) {
            const segDuration = currentStory.videoSegmentEnd - currentStory.videoSegmentStart;
            const ct = videoPlayer.currentTime || 0;
            const pct = segDuration > 0
              ? Math.min((ct - currentStory.videoSegmentStart) / segDuration, 1)
              : 0;
            setProgress(pct);
            if (ct >= currentStory.videoSegmentEnd) {
              goNext();
            }
          } else {
            const dur = videoPlayer.duration || 0;
            const ct = videoPlayer.currentTime || 0;
            const pct = dur > 0 ? Math.min(ct / dur, 1) : 0;
            setProgress(pct);
          }
        } catch {}
      }, 100);
    } else {
      if (videoSubRef.current) {
        videoSubRef.current.remove();
        videoSubRef.current = null;
      }
      elapsedRef.current = 0;
      tickStartRef.current = Date.now();
      timerRef.current = setInterval(() => {
        if (pausedRef.current) {
          tickStartRef.current = Date.now();
          return;
        }
        elapsedRef.current += Date.now() - tickStartRef.current;
        tickStartRef.current = Date.now();
        const pct = Math.min(elapsedRef.current / STORY_DURATION, 1);
        setProgress(pct);

        if (pct >= 1) {
          goNext();
        }
      }, 100);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (videoSubRef.current) {
        videoSubRef.current.remove();
        videoSubRef.current = null;
      }
      if (currentStory?.mediaType === 'video') {
        try { videoPlayer.pause(); } catch {}
      }
      if (pulseRef.current) pulseRef.current.stop();
      if (tempTimer.current) clearTimeout(tempTimer.current);
    };
  }, [storyIdx, groupIdx, visible, currentStory?.id]);

  const goNext = useCallback(() => {
    if (!currentGroup) return;

    if (storyIdx < currentStories.length - 1) {
      setStoryIdx((i) => i + 1);
      setProgress(0);
    } else if (groupIdx < groups.length - 1) {
      setGroupIdx((i) => i + 1);
      setStoryIdx(0);
      setProgress(0);
    } else {
      onClose();
    }
  }, [storyIdx, groupIdx, currentGroup, currentStories.length, groups.length, onClose]);

  const goPrev = useCallback(() => {
    if (storyIdx > 0) {
      setStoryIdx((i) => i - 1);
      setProgress(0);
    } else if (groupIdx > 0) {
      setGroupIdx((i) => i - 1);
      setStoryIdx(groups[groupIdx - 1]?.stories.length - 1 || 0);
      setProgress(0);
    }
  }, [storyIdx, groupIdx, groups]);

  const handleTap = (evt: any) => {
    const x = evt.nativeEvent.locationX;
    if (x < SCREEN_WIDTH * 0.3) {
      goPrev();
    } else {
      goNext();
    }
  };

  const handleReply = async () => {
    if (!replyText.trim() || !user || !currentGroup) return;
    setReplying(true);
    try {
      const chatId = await findOrCreateChat(user.uid, currentGroup.userId, currentGroup.userName);
      await db.collection('chats').doc(chatId).collection('messages').add({
        text: replyText.trim(),
        senderId: user.uid,
        participants: [user.uid, currentGroup.userId],
        readBy: [user.uid],
        timestamp: new Date(),
        storyContext: {
          type: 'reply',
          preview: {
            mediaUrl: currentStory.mediaUrl,
            mediaType: currentStory.mediaType,
            text: currentStory.text,
            bgColor: currentStory.bgColor,
          },
        },
        storyAuthorId: currentGroup.userId,
        storyAuthorName: currentGroup.userName,
      });
      updateChatLastMessage(chatId, replyText.trim(), user.uid);
      setReplyText('');
      onClose();
      navigation.navigate('Chat', { chatId, name: currentGroup.userName, photoURL: currentGroup.photoURL });
    } catch (e: any) {
      showToast(e?.message || 'Não foi possível responder', 'error');
    } finally {
      setReplying(false);
    }
  };

  if (!visible || !currentGroup) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <Animated.View
        style={[styles.container, { transform: [{ translateY: swipeTranslateY }], opacity: swipeOpacity }]}
        {...swipePanResponder.panHandlers}
      >
        <View style={styles.progressRow}>
          {currentStories.map((s, i) => (
            <View key={s.id} style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  i < storyIdx && styles.progressDone,
                  i === storyIdx && { width: `${progress * 100}%` },
                  i > storyIdx && styles.progressPending,
                ]}
              />
            </View>
          ))}
        </View>

        <View style={styles.header}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>
              {currentGroup.userName[0].toUpperCase()}
            </Text>
          </View>
          <Text style={styles.headerName}>{currentGroup.userName}</Text>
          <View style={styles.storyCounter}>
            <Text style={styles.storyCounterText}>{storyIdx + 1}/{currentStories.length}</Text>
          </View>
          {currentStory && (
            <TouchableOpacity accessibilityLabel="Compartilhar" style={styles.deleteBtn} onPress={async () => {
              try {
                const chatId = await findOrCreateChat(user!.uid, currentGroup.userId, currentGroup.userName);
                const msg = {
                  type: 'story_share' as const,
                  text: `${currentStory.userName || 'Alguém'} compartilhou um momento`,
                  storyId: currentStory.id,
                  timestamp: Date.now(),
                  senderId: user!.uid,
                };
                await db.collection('chats').doc(chatId).collection('messages').add(msg);
                await updateChatLastMessage(chatId, msg.text, user!.uid);
                showToast('Momento compartilhado na conversa', 'success');
              } catch { showToast('Erro ao compartilhar', 'error'); }
            }}>
              <Ionicons name="share-outline" size={16} color="#fff" />
            </TouchableOpacity>
          )}
          {isOwn && currentStory && (
            <>
              <TouchableOpacity accessibilityLabel="Visualizações" style={styles.viewersBtn} onPress={() => setShowViewers(true)}>
                <Ionicons name="eye-outline" size={18} color="#fff" />
                <Text style={styles.viewersBtnText}>{(currentStory.viewedBy || []).length}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityLabel="Apagar story"
                style={styles.deleteBtn}
                onPress={() => {
                  Alert.alert('Apagar momento', 'Tem certeza?', [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Apagar', style: 'destructive', onPress: async () => {
                      try {
                        await deleteStory(currentStory.id);
                        onClose();
                      } catch { showToast('Erro ao apagar', 'error'); }
                    }},
                  ]);
                }}
              >
                <Ionicons name="trash-outline" size={16} color="#fff" />
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity accessibilityLabel="Fechar" onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>X</Text>
          </TouchableOpacity>
        </View>

        <Pressable
          accessibilityLabel="Navegar entre stories"
          style={styles.touchArea}
          onPressIn={() => {
            pressStartRef.current = Date.now();
            pausedRef.current = true;
          }}
          onPressOut={(e) => {
            pausedRef.current = false;
            tickStartRef.current = Date.now();
            const elapsed = Date.now() - pressStartRef.current;
            if (elapsed < 300) {
              handleTap(e);
            }
          }}
        >
          {currentStory?.mediaUrl ? (
            currentStory.mediaType === 'video' ? (
              <View style={styles.media} pointerEvents="none">
                <VideoView
                  player={videoPlayer}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                  nativeControls={false}
                />
              </View>
            ) : (
              <Image
                source={currentStory.mediaUrl}
                style={styles.media}
                contentFit="contain"
                transition={300}
              />
            )
          ) : (
            <Animated.View style={[styles.textStory, { backgroundColor: currentStory?.bgColor || c.bg, opacity: fadeAnim }]}>
              <Animated.Text style={[styles.textStoryContent, { color: currentStory?.bgColor ? (isLightColor(currentStory.bgColor) ? '#1a1a2e' : '#fff') : c.text, transform: [{ scale: Animated.multiply(scaleAnim, pulseAnim) }] }]}>
                {currentStory?.text || ''}
              </Animated.Text>
            </Animated.View>
          )}
        </Pressable>

        {floatEmoji && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.floatEmojiContainer,
              {
                opacity: floatAnim.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [1, 1, 1, 0] }),
                transform: [{
                  translateY: floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -100] }),
                }],
              },
            ]}
          >
            <Text style={styles.floatEmojiText}>{floatEmoji}</Text>
          </Animated.View>
        )}
        {!isOwn && (
          <View style={[styles.replyBar, { paddingBottom: keyboardHeight > 0 ? 8 : 8 }]}>
            <View style={styles.reactionsRow}>
              {REACTIONS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  accessibilityLabel={"Reagir com " + emoji}
                  style={styles.reactionBtn}
                  onPress={() => handleReaction(emoji)}
                  disabled={reactionSending}
                >
                  <Text style={styles.reactionEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.replyInputRow}>
              <TextInput
                style={styles.replyInput}
                placeholder="Responder..."
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={replyText}
                onChangeText={setReplyText}
                editable={!replying}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
              />
              <TouchableOpacity
                accessibilityLabel="Enviar resposta"
                style={styles.replySend}
                onPress={handleReply}
                disabled={!replyText.trim() || replying}
              >
                {replying ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="send" size={20} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Animated.View>

      <Modal visible={showViewers} transparent animationType="fade" onRequestClose={() => setShowViewers(false)}>
        <TouchableOpacity accessibilityLabel="Fechar visualizações" style={styles.viewersOverlay} activeOpacity={1} onPress={() => setShowViewers(false)}>
          <View style={styles.viewersContent}>
            <Text style={styles.viewersTitle}>Visualizações</Text>
            {viewersLoading ? (
              <ActivityIndicator color={c.accent} style={{ marginVertical: 20 }} />
            ) : viewers.length === 0 ? (
              <Text style={styles.viewersEmpty}>Ninguém viu ainda</Text>
            ) : (
              <FlatList
                data={viewers}
                keyExtractor={(item) => item.uid}
                renderItem={({ item }) => (
                  <View style={styles.viewerItem}>
                    <View style={styles.viewerAvatar}>
                      <Text style={styles.viewerAvatarText}>{item.name[0]?.toUpperCase() || '?'}</Text>
                    </View>
                    <Text style={styles.viewerName}>{item.name}</Text>
                  </View>
                )}
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </Modal>
  );
}

function getStyles(c: ReturnType<typeof getColors>) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  progressRow: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingTop: 52,
    paddingBottom: 8,
  },
  progressTrack: {
    flex: 1,
    height: PROGRESS_BAR_HEIGHT,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: c.white,
    borderRadius: 1,
  },
  progressDone: {
    width: '100%',
  },
  progressPending: {
    width: '0%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.accentDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headerAvatarText: {
    color: c.text,
    fontSize: 14,
    fontWeight: 'bold',
  },
  headerName: {
    flex: 1,
    color: c.text,
    fontSize: 15,
    fontWeight: '600',
  },
  storyCounter: {
    marginRight: 10,
  },
  storyCounterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    color: c.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  touchArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  textStory: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  textStoryContent: {
    fontSize: 52,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 64,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  floatEmojiContainer: {
    position: 'absolute',
    bottom: 120,
    alignSelf: 'center',
    zIndex: 999,
  },
  floatEmojiText: {
    fontSize: 64,
  },
  viewersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  viewersBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  replyBar: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
    gap: 6,
  },
  reactionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
  },
  reactionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionEmoji: {
    fontSize: 22,
  },
  replyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  replyInput: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  replySend: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewersOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  viewersContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
    maxHeight: '60%',
  },
  viewersTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  viewersEmpty: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 20,
  },
  viewerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  viewerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.accentDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  viewerName: {
    color: '#fff',
    fontSize: 15,
  },
});
}
