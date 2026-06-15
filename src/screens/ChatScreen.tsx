import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Animated,
  AccessibilityInfo,
  PanResponder,
  Modal,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { AudioRecorder, requestRecordingPermissionsAsync, setAudioModeAsync, RecordingPresets } from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../services/firebase';
import firebase from 'firebase/compat/app';
import { useAuth } from '../contexts/AuthContext';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useMediaPicker } from '../hooks/useMediaPicker';
import { File, Paths, Directory } from 'expo-file-system';
import { uploadEncryptedChatMedia, uploadChatMedia, deleteMedia } from '../services/storage';
import { getMediaUri } from '../services/mediaCache';
import { colors } from '../theme/colors';
import { useSettingsStore } from '../store/settingsStore';
import AvatarImage from '../components/AvatarImage';
import MediaViewer from '../components/MediaViewer';
import AudioMessage from '../components/AudioMessage';
import { decryptAndCache, extractStoragePath, pathHash } from '../services/crypto';
import { useDecryptedMedia } from '../hooks/useDecryptedMedia';
import LottieView from 'lottie-react-native';
import StickerPicker from '../components/StickerPicker';
import ReactionBar from '../components/ReactionBar';
import { Sticker, getStickerById } from '../data/stickers';

const EMOJIS = ['😀', '😂', '🥰', '😎', '🎉', '❤️', '🔥', '👍', '👏', '💪', '🙏', '✨', '🌟', '💫', '⭐', '🌈', '🎨', '🎵', '🎶', '💜', '🦋', '🌺', '🌸', '🌻', '🍀', '🌊', '⛰️'];

function isEmojiOnly(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  for (const ch of t) {
    const code = ch.codePointAt(0)!;
    if (code < 0x800) return false;
  }
  return true;
}

function EmojiMessage({ text, isMine }: { text: string; isMine: boolean }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const reduceMotion = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      reduceMotion.current = enabled;
      if (enabled) return;

      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ]),
        { iterations: 2 }
      );
      pulse.start();
      return () => pulse.stop();
    });
  }, []);

  return (
    <Animated.Text
      style={[
        styles.emojiMessageText,
        isMine && styles.myMessageText,
        { transform: [{ scale: pulseAnim }] },
      ]}
    >
      {text}
    </Animated.Text>
  );
}

interface MessageBubbleProps {
  item: Message;
  user: { uid: string };
  isEmojiOnly: (text: string) => boolean;
  uploadingMessages: Record<string, string>;
  cachedUris: Record<string, string>;
  onLongPress: (msg: Message) => void;
  onViewOnceMedia: (msg: Message) => void;
  onReply: (msg: Message | null) => void;
  onViewMedia: (uri: string) => void;
  onReact: (msgId: string, emoji: string, currentReactions: { [emoji: string]: string[] } | undefined) => void;
}

function DownloadProgress() {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 1200, useNativeDriver: false }),
        Animated.timing(anim, { toValue: 0, duration: 1200, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={styles.downloadingBarTrack}>
      <Animated.View style={[styles.downloadingBarFill, { width }]} />
    </View>
  );
}

function MessageBubble({ item, user, isEmojiOnly, uploadingMessages, cachedUris, onLongPress, onViewOnceMedia, onReply, onViewMedia, onReact }: MessageBubbleProps) {
  const mountedRef = useRef(true);
  useEffect(() => { return () => { mountedRef.current = false; }; }, []);
  const [showReactions, setShowReactions] = useState(false);

  const itemRef = useRef(item);
  itemRef.current = item;
  const onReplyRef = useRef(onReply);
  onReplyRef.current = onReply;
  const swipeAnim = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (_, gs) =>
        Math.abs(gs.dx) > 15 && Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderMove: (_, gs) => {
        swipeAnim.setValue(Math.max(0, gs.dx));
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > 50) {
          onReplyRef.current(itemRef.current);
        }
        Animated.spring(swipeAnim, {
          toValue: 0,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (!mountedRef.current || !finished) {
            swipeAnim.setValue(0);
          }
        });
      },
    })
  ).current;

  const isDeletedForMe = (msg: Message): boolean => {
    if (msg.deletedForEveryone) return true;
    if (msg.deletedFor?.includes(user.uid)) return true;
    return false;
  };

  if (isDeletedForMe(item)) return null;

  const isMine = item.senderId === user.uid;
  const isEmojiMsg = item.text ? isEmojiOnly(item.text) : false;
  const isUploading = item.mediaUrl === '__uploading__';
  const localUri = uploadingMessages[item.id];
  const cachedUri = cachedUris[item.id];
  const isRemoteUrl = item.mediaUrl && !item.mediaUrl.startsWith('file://') && item.mediaUrl !== '__uploading__';
  const { uri: decryptedUri, loading: decrypting } = useDecryptedMedia({
    mediaUrl: isRemoteUrl ? item.mediaUrl : null,
    mediaKey: item.mediaKey,
    mediaIv: item.mediaIv,
    mediaType: item.mediaType,
  });
  const hasEncryption = !!(item.mediaKey && item.mediaIv);
  const displayUri = isUploading && localUri ? localUri
    : !isUploading && decryptedUri ? decryptedUri
    : isRemoteUrl && !hasEncryption && cachedUri ? cachedUri
    : item.mediaUrl;

  const isViewOnceMedia = item.viewOnce && item.mediaUrl && item.mediaUrl !== '__uploading__';
  const wasViewedOnce = isViewOnceMedia && item.viewedOnceBy?.includes(user.uid) && item.senderId !== user.uid;

  const renderReplyPreview = () => {
    const fromName = item.senderId === user.uid ? 'Você' : (item.replyTo?.senderName || '');
    const replyContent = item.replyTo?.text || (item.replyTo?.audioUrl ? '🎤 Áudio' : item.replyTo?.mediaUrl ? '📷 Mídia' : '');
    return (
      <View style={[styles.replyQuote, isMine && styles.replyQuoteMine]}>
        <View style={styles.replyBar} />
        <View style={styles.replyContent}>
          <Text style={styles.replyName}>{fromName}</Text>
          <Text style={styles.replyText} numberOfLines={2}>{replyContent}</Text>
        </View>
      </View>
    );
  };

  const replyIndicatorOpacity = swipeAnim.interpolate({
    inputRange: [0, 60],
    outputRange: [0, 1],
  });
  const swipeTranslate = swipeAnim.interpolate({
    inputRange: [0, 300],
    outputRange: [0, 80],
    extrapolate: 'clamp',
  });

  const userReactions = item.reactions
    ? Object.entries(item.reactions)
        .filter(([, userIds]) => userIds.includes(user.uid))
        .map(([emoji]) => emoji)
    : [];

  const handleReactionTap = (emoji: string) => {
    onReact(item.id, emoji, item.reactions);
    setShowReactions(false);
  };

  return (
    <View style={styles.swipeContainer} {...panResponder.panHandlers}>
      {showReactions && (
        <View style={[styles.reactionBarOverlay, isMine ? styles.reactionBarOverlayMine : styles.reactionBarOverlayOther]}>
          <ReactionBar onReact={handleReactionTap} userReactions={userReactions} />
        </View>
      )}
      <Animated.View style={[styles.replyIndicator, { opacity: replyIndicatorOpacity }]}>
        <Ionicons name="arrow-forward" size={20} color="#fff" />
        <Text style={styles.replyIndicatorText}>Responder</Text>
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX: swipeTranslate }] }}>
    <TouchableOpacity
      style={[styles.messageRow, isMine && styles.myMessageRow]}
      onLongPress={() => { setShowReactions(true); onLongPress(itemRef.current); }}
      delayLongPress={400}
      activeOpacity={0.8}
    >
      <View style={[styles.messageBubble, isMine ? styles.myBubble : styles.otherBubble, isEmojiMsg && styles.emojiBubble, item.sticker && styles.stickerBubble, item.mediaUrl && styles.mediaBubble]}>
        {item.replyTo && renderReplyPreview()}
        {item.forwarded && (
          <Text style={styles.forwardedLabel}>Encaminhada</Text>
        )}
        {wasViewedOnce ? (
          <View style={styles.viewOncePlaceholder}>
            <Text style={{ fontSize: 16 }}>👁️</Text>
            <Text style={styles.viewOncePlaceholderText}>Aberta</Text>
          </View>
        ) : isViewOnceMedia && item.senderId !== user.uid ? (
          <TouchableOpacity onPress={() => onViewOnceMedia(item)} activeOpacity={0.7}>
            <View style={styles.viewOnceBlur}>
              <Text style={styles.viewOnceIcon}>👁️</Text>
              <Text style={styles.viewOnceLabel}>Toque para ver</Text>
            </View>
          </TouchableOpacity>
        ) : displayUri && displayUri !== '__uploading__' ? (
          <View>
            <TouchableOpacity onPress={() => onViewMedia(decryptedUri || displayUri)} activeOpacity={0.8}>
              <Image
                source={displayUri}
                style={styles.mediaImage}
                contentFit="cover"
                transition={200}
              />
            </TouchableOpacity>
            {(item.viewOnce || isViewOnceMedia) && isMine && (
              <View style={styles.viewOnceBadge}>
                <Text style={styles.viewOnceBadgeText}>👁️ 1</Text>
              </View>
            )}
            {isUploading && (
              <View style={styles.sendingOverlay}>
                <ActivityIndicator color={colors.white} />
                <Text style={styles.sendingText}>Enviando...</Text>
              </View>
            )}
            {isRemoteUrl && decrypting && (
              <View style={styles.downloadingOverlay}>
                <DownloadProgress />
                <Text style={styles.downloadingText}>Baixando...</Text>
              </View>
            )}
          </View>
        ) : isUploading ? (
          <ActivityIndicator color={colors.accent} style={styles.uploadingIndicator} />
        ) : isRemoteUrl && decrypting ? (
          <ActivityIndicator color={colors.accent} style={styles.uploadingIndicator} />
        ) : null}
        {item.audioUrl && item.audioUrl !== '__uploading__' ? (
          <AudioMessage uri={item.audioUrl} duration={item.duration || 0} isMine={isMine} />
        ) : item.audioUrl === '__uploading__' ? (
          <ActivityIndicator color={colors.accent} style={styles.uploadingIndicator} />
        ) : null}
        {item.sticker ? (
          <View style={styles.stickerContainer}>
            <LottieView
              source={{ uri: item.sticker.lottieUrl }}
              style={styles.stickerAnim}
              autoPlay
              loop
              resizeMode="contain"
            />
          </View>
        ) : item.deletedForEveryone ? (
          <Text style={styles.deletedText}>Mensagem apagada</Text>
        ) : item.text ? (
          isEmojiOnly(item.text) ? (
            <EmojiMessage text={item.text} isMine={isMine} />
          ) : (
            <Text style={[styles.messageText, isMine && styles.myMessageText]}>
              {item.text}
            </Text>
          )
        ) : null}
        {item.viewOnce && !item.mediaUrl && (
          <Text style={styles.viewOnceHint}>Visualização única</Text>
        )}
        {item.reactions && (
          <View style={styles.reactionBadgeRow}>
            {Object.entries(item.reactions)
              .filter(([, userIds]) => userIds.length > 0)
              .sort(([, a], [, b]) => b.length - a.length)
              .slice(0, 4)
              .map(([emoji, userIds]) => (
                <View key={emoji} style={styles.reactionBadge}>
                  <Text style={styles.reactionBadgeEmoji}>{emoji}</Text>
                  {userIds.length > 1 && (
                    <Text style={styles.reactionBadgeCount}>{userIds.length}</Text>
                  )}
                </View>
              ))}
          </View>
        )}
        {isMine && (
          <View style={styles.readStatusRow}>
            <Text style={[styles.readStatusText, (item.readBy || []).length > 1 ? styles.readStatusRead : undefined]}>
              {(item.readBy || []).filter((id) => id !== user.uid).length > 0 ? '✓✓' : '✓'}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
    </Animated.View>
    </View>
  );
}

type ChatRoute = RouteProp<RootStackParamList, 'Chat'>;

interface Message {
  id: string;
  text?: string;
  mediaUrl?: string;
  mediaKey?: string;
  mediaIv?: string;
  mediaType?: string;
  senderId: string;
  senderName?: string;
  timestamp: any;
  participants: string[];
  forwarded?: boolean;
  readBy?: string[];
  deletedFor?: string[];
  deletedForEveryone?: boolean;
  viewOnce?: boolean;
  viewedOnceBy?: string[];
  audioUrl?: string;
  duration?: number;
  reactions?: { [emoji: string]: string[] };
  sticker?: { id: string; emoji: string; name: string; lottieUrl: string };
  replyTo?: {
    id: string;
    text?: string;
    senderId: string;
    senderName: string;
    mediaUrl?: string;
    mediaKey?: string;
    mediaIv?: string;
    audioUrl?: string;
  };
}

export default function ChatScreen() {
  const route = useRoute<ChatRoute>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { chatId, name: peerName } = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingInstance, setRecordingInstance] = useState<AudioRecorder | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<{ uri: string; type: string } | null>(null);
  const [uploadingMessages, setUploadingMessages] = useState<Record<string, string>>({});
  const [cachedUris, setCachedUris] = useState<Record<string, string>>({});
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [peerPhoto, setPeerPhoto] = useState<string | null>(null);
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [viewOnceMode, setViewOnceMode] = useState(false);
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const [forwardMsg, setForwardMsg] = useState<Message | null>(null);
  const [forwardChats, setForwardChats] = useState<{ id: string; name: string }[]>([]);
  const [chatDocName, setChatDocName] = useState<string | null>(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [participantNames, setParticipantNames] = useState<Record<string, string>>({});
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [groupSearchResults, setGroupSearchResults] = useState<{ uid: string; name: string }[]>([]);
  const [editingGroupName, setEditingGroupName] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const autoDownload = useSettingsStore((s) => s.autoDownload);
  const flatListRef = useRef<FlatList>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { pickFromGallery, takePhoto, loading: mediaLoading } = useMediaPicker();

  useEffect(() => {
    const chatRef = db.collection('chats').doc(chatId);
    chatRef.get().then((doc) => {
      if (doc.exists) {
        const data = doc.data()!;
        setParticipants(data.participants || []);
        if (data.name) setChatDocName(data.name);
        if (!data.participants || data.participants.length === 0) tryInferParticipants();
      } else {
        db.collection('groups').doc(chatId).get().then((gDoc) => {
          if (gDoc.exists) {
            const gData = gDoc.data()!;
            setParticipants(gData.participants || []);
            if (gData.name) setChatDocName(gData.name);
            if (!gData.participants || gData.participants.length === 0) tryInferParticipants();
          } else {
            tryInferParticipants();
          }
        }).catch(() => { tryInferParticipants(); });
      }
    }).catch((e) => {
      console.error('Chat doc fetch error:', e);
      tryInferParticipants();
    });
    function tryInferParticipants() {
      const ids = chatId.split('_');
      if (ids.length >= 2) {
        const uids = ids.filter((id) => id.length > 10);
        if (uids.length >= 2) setParticipants(uids);
      }
    }
  }, [chatId]);

  useEffect(() => {
    return db.collection('chats').doc(chatId).collection('messages')
      .orderBy('timestamp', 'asc')
      .onSnapshot((snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Message[];
      setMessages(msgs);
      setLoading(false);
      setError(null);
    }, (err) => {
      setLoading(false);
      setError('Erro ao carregar mensagens');
      console.error('Messages onSnapshot error:', err);
    });
  }, [chatId]);

  const peerId = participants.find((p) => p !== user?.uid);
  const isGroup = participants.length > 2;

  useEffect(() => {
    if (!user || !peerId) return;
    db.collection('users').doc(peerId).get().then((doc) => {
      if (doc.exists) setPeerPhoto(doc.data()?.photoURL || null);
    }).catch(() => {});
    navigation.setOptions({
      headerTitle: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <AvatarImage photoURL={peerPhoto} name={peerName} size={36} />
          <View>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600' }}>{peerName}</Text>
            {isPeerTyping && (
              <Text style={{ color: colors.accent, fontSize: 12 }}>digitando...</Text>
            )}
          </View>
        </View>
      ),
      headerRight: () => (
        <View style={{ flexDirection: 'row', gap: 16, marginRight: 4 }}>
          <TouchableOpacity onPress={() => { setIsSearching((s) => !s); if (!isSearching) setTimeout(() => searchInputRef.current?.focus(), 100); }}>
            <Ionicons name={isSearching ? 'close-outline' : 'search-outline'} size={22} color={colors.accent} />
          </TouchableOpacity>
          {isGroup && (
            <TouchableOpacity onPress={() => setShowGroupInfo(true)}>
              <Ionicons name="information-circle-outline" size={22} color={colors.accent} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('Call', { peerId, peerName, audioOnly: true })
            }
          >
            <Ionicons name="call-outline" size={22} color={colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('Call', { peerId, peerName, audioOnly: false })
            }
          >
            <Ionicons name="videocam-outline" size={22} color={colors.accent} />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [user, peerId, peerName, navigation, peerPhoto, isPeerTyping, isSearching, isGroup]);

  const chatDocRef = db.collection('chats').doc(chatId);

  const emitTyping = useCallback(() => {
    chatDocRef.update({ [`typing.${user?.uid}`]: new Date().toISOString() }).catch(() => {});
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      chatDocRef.update({ [`typing.${user?.uid}`]: firebase.firestore.FieldValue.delete() }).catch(() => {});
    }, 2000);
  }, [chatId, user?.uid]);

  useEffect(() => {
    const peerUid = participants.find((p) => p !== user?.uid);
    if (!peerUid) return;
    const unsub = chatDocRef.onSnapshot((snap) => {
      const typing = snap.data()?.typing || {};
      const peerTypingAt = typing[peerUid];
      if (peerTypingAt) {
        const diff = Date.now() - new Date(peerTypingAt).getTime();
        setIsPeerTyping(diff < 3000);
      } else {
        setIsPeerTyping(false);
      }
    }, () => {});
    return unsub;
  }, [chatId, participants, user?.uid]);

  useEffect(() => {
    if (participants.length === 0) return;
    const fetchNames = async () => {
      const map: Record<string, string> = {};
      const chunks: string[][] = [];
      for (let i = 0; i < participants.length; i += 10) chunks.push(participants.slice(i, i + 10));
      for (const chunk of chunks) {
        const snap = await db.collection('users').where('uid', 'in', chunk).get();
        snap.docs.forEach((d) => { map[d.id] = d.data().displayName || 'Usuário'; });
      }
      setParticipantNames(map);
    };
    fetchNames();
  }, [participants]);

  useEffect(() => {
    setUploadingMessages((prev) => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        const msg = messages.find((m) => m.id === id);
        if (!msg || msg.mediaUrl !== '__uploading__') {
          delete next[id];
        }
      }
      return next;
    });
  }, [messages]);

  const markAsRead = useCallback((msgIds: string[]) => {
    if (!user || msgIds.length === 0) return;
    const batch = db.batch();
    msgIds.forEach((id) => {
      batch.update(db.collection('chats').doc(chatId).collection('messages').doc(id), {
        readBy: firebase.firestore.FieldValue.arrayUnion(user.uid),
      });
    });
    batch.commit().catch(() => {});
  }, [user, chatId]);

  useEffect(() => {
    const unread = messages
      .filter((m) => m.senderId !== user?.uid && !(m.readBy || []).includes(user?.uid || ''))
      .map((m) => m.id);
    if (unread.length > 0 && unread.length <= 20) {
      markAsRead(unread);
    }
  }, [messages, user?.uid]);

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (autoDownload === 'never') return;

    const shouldDownload = (url: string) => {
      if (url.startsWith('file://') || url === '__uploading__') return false;
      return true;
    };

    const remoteMessages = messages.filter(
      (m) => m.mediaUrl && shouldDownload(m.mediaUrl) && !cachedUris[m.id]
    );
    if (remoteMessages.length === 0) return;

    remoteMessages.forEach((msg) => {
      getMediaUri(msg.mediaUrl!).then((localUri) => {
        setCachedUris((prev) => ({ ...prev, [msg.id]: localUri }));
      }).catch((e) => console.error('Media cache error:', e));
    });
  }, [messages, autoDownload]);

  const sendMessage = async () => {
    if (!text.trim() || !user) return;
    setSending(true);
    try {
      const replyData = replyTo ? {
        id: replyTo.id,
        text: replyTo.text || null,
        senderId: replyTo.senderId,
        senderName: replyTo.senderName || '',
        mediaUrl: replyTo.mediaUrl || null,
        audioUrl: replyTo.audioUrl || null,
      } : null;
      await db.collection('chats').doc(chatId).collection('messages').add({
        text: text.trim(),
        senderId: user.uid,
        participants,
        readBy: [user.uid],
        timestamp: new Date(),
        replyTo: replyData,
      });
      setText('');
      setReplyTo(null);
    } catch (error: any) {
      Alert.alert('Erro', error?.message || 'Não foi possível enviar a mensagem');
    } finally {
      setSending(false);
    }
  };

  const sendMediaWithText = useCallback(async () => {
    if (!selectedMedia || !user) return;

    setSending(true);
    const media = selectedMedia;
    const textToSend = text.trim();
    const isViewOnce = viewOnceMode;
    const replyData = replyTo ? {
      id: replyTo.id,
      text: replyTo.text || null,
      senderId: replyTo.senderId,
      senderName: replyTo.senderName || '',
      mediaUrl: replyTo.mediaUrl || null,
      audioUrl: replyTo.audioUrl || null,
    } : null;
    setSelectedMedia(null);
    setText('');
    setViewOnceMode(false);
    setReplyTo(null);

    try {
      const docRef = await db.collection('chats').doc(chatId).collection('messages').add({
        text: textToSend,
        mediaUrl: '__uploading__',
        mediaType: media.type,
        senderId: user.uid,
        participants,
        readBy: [user.uid],
        viewOnce: isViewOnce || undefined,
        timestamp: new Date(),
        replyTo: replyData,
      });

      setUploadingMessages((prev) => ({ ...prev, [docRef.id]: media.uri }));

      const result = await uploadEncryptedChatMedia(chatId, docRef.id, media.uri);
      if (result) {
        await db.collection('chats').doc(chatId).collection('messages').doc(docRef.id).update({
          mediaUrl: result.mediaUrl,
          mediaKey: result.mediaKey,
          mediaIv: result.mediaIv,
        });
      }
    } catch (error: any) {
      Alert.alert('Erro', error?.message || 'Não foi possível enviar a mídia');
    } finally {
      setSending(false);
    }
  }, [selectedMedia, user, participants, chatId, text, viewOnceMode, replyTo]);

  const handlePickMedia = useCallback(async () => {
    const media = await pickFromGallery();
    if (media) {
      if (media.type === 'image') {
        navigation.navigate('EditImage', { imageUri: media.uri, chatId, name: peerName });
      } else {
        setSelectedMedia(media);
      }
    }
  }, [pickFromGallery, navigation, chatId, peerName]);

  const handleCancelMedia = useCallback(() => {
    setSelectedMedia(null);
    setViewOnceMode(false);
  }, []);

  useEffect(() => {
    const editedUri = (route.params as any).editedImageUri;
    if (editedUri) {
      setSelectedMedia({ uri: editedUri, type: 'image' });
      navigation.setParams({ editedImageUri: undefined } as any);
    }
  }, [(route.params as any).editedImageUri]);

  const handleLongPress = useCallback((msg: Message) => {
    const isMine = msg.senderId === user?.uid;
    setSelectedMsgId(msg.id);

    const actions: { text: string; style?: 'destructive' | 'cancel'; onPress: () => void }[] = [
      { text: 'Encaminhar', onPress: () => handleForward(msg) },
    ];
    if (isMine) {
      actions.push({ text: 'Apagar para mim', style: 'destructive', onPress: () => handleDeleteForMe(msg.id) });
      if (!msg.viewOnce) {
        actions.push({ text: 'Apagar para todos', style: 'destructive', onPress: () => {
          Alert.alert(
            'Apagar para todos?',
            'Esta mensagem será apagada para todos. Esta ação não pode ser desfeita.',
            [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Apagar', style: 'destructive', onPress: () => handleDeleteForEveryone(msg) },
            ]
          );
        }});
      }
    }
    actions.push({ text: 'Cancelar', style: 'cancel', onPress: () => {} });

    Alert.alert('Ações', '', actions);
  }, [user]);

  const handleForward = useCallback(async (msg: Message) => {
    if (!user) return;
    setForwardMsg(msg);
    try {
      const snap = await db.collection('chats')
        .where('participants', 'array-contains', user.uid)
        .get();
      const chats = await Promise.all(snap.docs.map(async (doc) => {
        const data = doc.data();
        const otherId = (data.participants || []).find((p: string) => p !== user.uid);
        let name = data.name || '';
        if (!name && otherId) {
          const userSnap = await db.collection('users').doc(otherId).get();
          name = userSnap.data()?.displayName || 'Usuário';
        }
        return { id: doc.id, name };
      }));
      setForwardChats(chats.filter((c) => c.id !== chatId));
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar os chats');
    }
  }, [user, chatId]);

  const executeForward = useCallback(async (targetChatId: string) => {
    if (!forwardMsg || !user) return;
    try {
      const { text, mediaUrl, mediaKey, mediaIv, mediaType, audioUrl, duration, sticker } = forwardMsg;
      await db.collection('chats').doc(targetChatId).collection('messages').add({
        text: text || '',
        mediaUrl: mediaUrl || null,
        mediaKey: mediaKey || null,
        mediaIv: mediaIv || null,
        mediaType: mediaType || null,
        audioUrl: audioUrl || null,
        duration: duration || null,
        sticker: sticker || null,
        senderId: user.uid,
        senderName: user.displayName || 'Usuário',
        participants: [],
        readBy: [user.uid],
        forwarded: true,
        timestamp: new Date(),
      });
    } catch {
      Alert.alert('Erro', 'Não foi possível encaminhar a mensagem');
    }
    setForwardMsg(null);
    setForwardChats([]);
  }, [forwardMsg, user]);

  const handleDeleteForMe = async (messageId: string) => {
    try {
      await db.collection('chats').doc(chatId).collection('messages').doc(messageId).update({
        deletedFor: firebase.firestore.FieldValue.arrayUnion(user!.uid),
      });
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Não foi possível apagar a mensagem');
    }
    setSelectedMsgId(null);
  };

  const handleDeleteForEveryone = async (msg: Message) => {
    try {
      if (msg.mediaUrl && msg.mediaUrl !== '__uploading__' && !msg.mediaUrl.startsWith('file://')) {
        const storagePath = extractStoragePath(msg.mediaUrl);
        await deleteMedia(storagePath);
        const cacheDir = new Directory(Paths.cache, 'rilaxy-decrypted');
        const ext = msg.mediaType?.startsWith('video/') ? 'mp4' : 'jpg';
        const cacheFile = new File(cacheDir, `${pathHash(msg.mediaUrl)}.${ext}`);
        if (cacheFile.exists) cacheFile.delete();
      }
      if (msg.audioUrl && msg.audioUrl !== '__uploading__' && !msg.audioUrl.startsWith('file://')) {
        const storagePath = extractStoragePath(msg.audioUrl);
        await deleteMedia(storagePath);
      }
      await db.collection('chats').doc(chatId).collection('messages').doc(msg.id).update({
        deletedForEveryone: true,
      });
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Não foi possível apagar para todos');
    }
    setSelectedMsgId(null);
  };

  const handleViewOnceMedia = useCallback((msg: Message) => {
    if (msg.mediaUrl && msg.mediaUrl !== '__uploading__') {
      setViewerUri(msg.mediaUrl);
      db.collection('chats').doc(chatId).collection('messages').doc(msg.id).update({
        viewedOnceBy: firebase.firestore.FieldValue.arrayUnion(user!.uid),
      }).catch((e) => {
        console.error('viewOnce update error:', e);
      });
    }
  }, [chatId, user]);

  const formattedTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert('Permissão', 'Permita acesso ao microfone para gravar áudio');
        return;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      const recording = new AudioRecorder(RecordingPresets.HIGH_QUALITY);
      await recording.prepareToRecordAsync();
      recording.record();
      setRecordingInstance(recording);
      setIsRecording(true);
      const intervalId = setInterval(() => {
        const state = recording.getStatus();
        if (state.isRecording) {
          setRecordingTime(state.durationMillis / 1000);
        }
      }, 200);
      recordingIntervalRef.current = intervalId;
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Não foi possível iniciar gravação');
    }
  };

  const stopRecording = async () => {
    if (!recordingInstance) return;
    try {
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      await recordingInstance.stop();
      const uri = recordingInstance.uri;
      const state = recordingInstance.getStatus();
      const duration = state.durationMillis ? state.durationMillis / 1000 : 0;
      setRecordingInstance(null);
      setRecordingTime(0);
      if (uri) await sendAudio(uri, Math.round(duration));
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Não foi possível finalizar gravação');
    }
  };

  const sendAudio = async (uri: string, duration: number) => {
    if (!user) return;
    setSending(true);
    const replyData = replyTo ? {
      id: replyTo.id,
      text: replyTo.text || null,
      senderId: replyTo.senderId,
      senderName: replyTo.senderName || '',
      mediaUrl: replyTo.mediaUrl || null,
      audioUrl: replyTo.audioUrl || null,
    } : null;
    try {
      const docRef = await db.collection('chats').doc(chatId).collection('messages').add({
        audioUrl: '__uploading__',
        duration,
        senderId: user.uid,
        participants,
        readBy: [user.uid],
        timestamp: new Date(),
        replyTo: replyData,
      });
      setReplyTo(null);
      const publicUrl = await uploadChatMedia(chatId, docRef.id, uri);
      if (publicUrl) {
        await docRef.update({ audioUrl: publicUrl });
      }
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Não foi possível enviar áudio');
    } finally {
      setSending(false);
    }
  };

  const sendSticker = useCallback(async (sticker: Sticker) => {
    if (!user) return;
    setSending(true);
    setShowStickerPicker(false);
    useSettingsStore.getState().incrementStickerUsage(sticker.id);
    try {
      await db.collection('chats').doc(chatId).collection('messages').add({
        sticker: { id: sticker.id, emoji: sticker.emoji, name: sticker.name, lottieUrl: sticker.lottieUrl },
        senderId: user.uid,
        participants,
        readBy: [user.uid],
        timestamp: new Date(),
      });
    } catch (error: any) {
      Alert.alert('Erro', error?.message || 'Não foi possível enviar figurinha');
    } finally {
      setSending(false);
    }
  }, [user, participants, chatId]);

  const handleReact = useCallback(async (msgId: string, emoji: string, currentReactions: { [emoji: string]: string[] } | undefined) => {
    if (!user) return;
    const existing = currentReactions?.[emoji] || [];
    const alreadyReacted = existing.includes(user.uid);
    try {
      if (alreadyReacted) {
        await db.collection('chats').doc(chatId).collection('messages').doc(msgId).update({
          [`reactions.${emoji}`]: firebase.firestore.FieldValue.arrayRemove(user.uid),
        });
      } else {
        await db.collection('chats').doc(chatId).collection('messages').doc(msgId).update({
          [`reactions.${emoji}`]: firebase.firestore.FieldValue.arrayUnion(user.uid),
        });
      }
    } catch (e: any) {
      console.error('React error:', e?.message);
    }
  }, [user, chatId]);

  const renderMessage = ({ item }: { item: Message }) => (
    <MessageBubble
      item={item}
      user={user!}
      isEmojiOnly={isEmojiOnly}
      uploadingMessages={uploadingMessages}
      cachedUris={cachedUris}
      onLongPress={handleLongPress}
      onViewOnceMedia={handleViewOnceMedia}
      onReply={setReplyTo}
      onViewMedia={setViewerUri}
      onReact={handleReact}
    />
  );

  const visibleMessages = messages.filter(
    (m) => !(m.deletedFor?.includes(user?.uid || ''))
  );

  const filteredMessages = searchQuery.trim()
    ? visibleMessages.filter((m) => m.text?.toLowerCase().includes(searchQuery.toLowerCase()))
    : visibleMessages;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {isSearching && (
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Buscar mensagens..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}
      <FlatList
        ref={flatListRef}
        data={filteredMessages}
        keyExtractor={(item) => item.id}
        renderItem={loading ? () => null : renderMessage}
        style={styles.messageList}
        contentContainerStyle={[styles.messageListContent, loading && styles.messageListCenter]}
        ListEmptyComponent={
          loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : (
            <View style={styles.center}>
              <Ionicons name="chatbubble-ellipses-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>Nenhuma mensagem ainda</Text>
              <Text style={styles.emptySubtext}>Envie algo para começar</Text>
            </View>
          )
        }
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
      />
      {replyTo && (
        <View style={styles.replyPreviewContainer}>
          <View style={styles.replyPreviewBar} />
          <View style={styles.replyPreviewContent}>
            <Text style={styles.replyPreviewName}>{replyTo.senderId === user?.uid ? 'Você' : (replyTo.senderName || '')}</Text>
            <Text style={styles.replyPreviewText} numberOfLines={1}>
              {replyTo.text || (replyTo.audioUrl ? '🎤 Áudio' : replyTo.mediaUrl ? '📷 Mídia' : '')}
            </Text>
          </View>
          <TouchableOpacity style={styles.replyCloseButton} onPress={() => setReplyTo(null)}>
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.inputContainer}>
        {showStickerPicker && (
          <StickerPicker
            onSelect={sendSticker}
            onClose={() => setShowStickerPicker(false)}
          />
        )}
        {showEmojiPicker && (
          <View style={styles.emojiGrid}>
            {EMOJIS.map((emoji, idx) => (
              <TouchableOpacity key={idx} style={styles.emojiItem} onPress={() => setText((prev) => prev + emoji)}>
                <Text style={styles.emojiText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <TouchableOpacity style={styles.attachButton} onPress={handlePickMedia} disabled={mediaLoading}>
          <Text style={styles.attachText}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.emojiButton} onPress={() => { setShowEmojiPicker(!showEmojiPicker); setShowStickerPicker(false); }}>
          <Text style={styles.emojiButtonText}>😊</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.emojiButton} onPress={() => { setShowStickerPicker(!showStickerPicker); setShowEmojiPicker(false); }}>
          <Text style={styles.emojiButtonText}>🎯</Text>
        </TouchableOpacity>
        {selectedMedia ? (
          <View style={styles.mediaPreviewContainer}>
            <View style={styles.mediaPreviewImageWrap}>
              <Image source={selectedMedia.uri} style={styles.mediaPreviewImage} contentFit="cover" transition={200} />
              <TouchableOpacity style={styles.mediaPreviewCancel} onPress={handleCancelMedia}>
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.viewOnceToggleBtn, viewOnceMode && styles.viewOnceToggleBtnActive]}
                onPress={() => setViewOnceMode(!viewOnceMode)}
              >
                <Text style={[styles.viewOnceToggleNum, viewOnceMode && styles.viewOnceToggleNumActive]}>1</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.mediaInputRow}>
              <TextInput
                style={styles.mediaInput}
                placeholder="Adicione uma legenda..."
                placeholderTextColor={colors.textMuted}
                value={text}
                onChangeText={(val) => { setText(val); emitTyping(); }}
                multiline
              />
              <TouchableOpacity
                style={[styles.sendMediaButton, sending && styles.disabled]}
                onPress={sendMediaWithText}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={colors.bg} />
                ) : (
                  <Ionicons name="send" size={20} color={colors.text} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : isRecording ? (
          <View style={styles.recordingContainer}>
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingTime}>{formattedTime(recordingTime)}</Text>
            </View>
            <TouchableOpacity onPress={stopRecording}>
              <Ionicons name="stop-circle" size={36} color={colors.destructive} />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TextInput
              style={styles.input}
              placeholder="Mensagem"
              placeholderTextColor={colors.textMuted}
              value={text}
              onChangeText={(val) => { setText(val); emitTyping(); }}

              
              multiline
            />
            {text.trim() ? (
              <TouchableOpacity
                style={[styles.sendIconButton, sending && styles.disabled]}
                onPress={sendMessage}
                disabled={sending}
              >
                <Ionicons name="send" size={20} color={colors.text} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.micButton}
                onPress={startRecording}
                disabled={sending}
              >
                <Ionicons name="mic" size={20} color={colors.text} />
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
      <MediaViewer visible={!!viewerUri} uri={viewerUri} onClose={() => setViewerUri(null)} />
      <Modal visible={forwardMsg !== null} transparent animationType="slide" onRequestClose={() => { setForwardMsg(null); setForwardChats([]); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.forwardModal}>
            <View style={styles.forwardModalHeader}>
              <Text style={styles.forwardModalTitle}>Encaminhar para</Text>
              <TouchableOpacity onPress={() => { setForwardMsg(null); setForwardChats([]); }}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            {forwardChats.length === 0 ? (
              <View style={styles.forwardEmpty}>
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : (
              <ScrollView>
                {forwardChats.map((c) => (
                  <TouchableOpacity key={c.id} style={styles.forwardChatItem} onPress={() => executeForward(c.id)}>
                    <View style={styles.forwardAvatar}>
                      <Text style={styles.forwardAvatarText}>{c.name[0]?.toUpperCase() || '?'}</Text>
                    </View>
                    <Text style={styles.forwardChatName}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
      <Modal visible={showGroupInfo} transparent animationType="slide" onRequestClose={() => setShowGroupInfo(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.forwardModal}>
            <View style={styles.forwardModalHeader}>
              <Text style={styles.forwardModalTitle}>{chatDocName || 'Informações do grupo'}</Text>
              <TouchableOpacity onPress={() => setShowGroupInfo(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.groupInfoSection}>
              <Text style={styles.groupInfoLabel}>Participantes ({participants.length})</Text>
              {participants.map((pid) => {
                const pName = pid === user?.uid ? 'Você' : participantNames[pid] || 'Carregando...';
                const isRemovable = isGroup && pid !== user?.uid;
                return (
                  <View key={pid} style={styles.groupParticipantRow}>
                    <View style={styles.forwardAvatar}>
                      <Text style={styles.forwardAvatarText}>{(pName[0] || '?').toUpperCase()}</Text>
                    </View>
                    <Text style={styles.forwardChatName}>{pName}</Text>
                    {isRemovable && (
                      <TouchableOpacity style={styles.removeParticipantBtn} onPress={() => {
                        Alert.alert('Remover participante?', `${pName} será removido do grupo.`, [
                          { text: 'Cancelar', style: 'cancel' },
                          { text: 'Remover', style: 'destructive', onPress: async () => {
                            try {
                              await db.collection('chats').doc(chatId).update({
                                participants: firebase.firestore.FieldValue.arrayRemove(pid),
                              });
                              setParticipants((prev) => prev.filter((p) => p !== pid));
                            } catch { Alert.alert('Erro', 'Não foi possível remover'); }
                          }},
                        ]);
                      }}>
                        <Ionicons name="close-outline" size={20} color={colors.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
              {isGroup && (
                <>
                  <TextInput
                    style={styles.groupSearchInput}
                    placeholder="Adicionar participante (digite o nome)..."
                    placeholderTextColor={colors.textMuted}
                    value={groupSearchQuery}
                    onChangeText={async (val) => {
                      setGroupSearchQuery(val);
                      if (val.trim().length < 2) { setGroupSearchResults([]); return; }
                      const snap = await db.collection('users')
                        .where('displayNameLower', '>=', val.toLowerCase())
                        .where('displayNameLower', '<=', val.toLowerCase() + '\uf8ff')
                        .limit(5).get();
                      setGroupSearchResults(snap.docs.map((d) => ({ uid: d.id, name: d.data().displayName || 'Usuário' })));
                    }}
                  />
                  {groupSearchResults.map((r) => (
                    <TouchableOpacity key={r.uid} style={styles.groupParticipantRow} onPress={async () => {
                      try {
                        await db.collection('chats').doc(chatId).update({
                          participants: firebase.firestore.FieldValue.arrayUnion(r.uid),
                        });
                        await db.collection('groups').doc(chatId).update({
                          participants: firebase.firestore.FieldValue.arrayUnion(r.uid),
                        }).catch(() => {});
                        setParticipants((prev) => [...prev, r.uid]);
                        setGroupSearchQuery('');
                        setGroupSearchResults([]);
                      } catch { Alert.alert('Erro', 'Não foi possível adicionar'); }
                    }}>
                      <View style={styles.forwardAvatar}>
                        <Text style={styles.forwardAvatarText}>{(r.name[0] || '?').toUpperCase()}</Text>
                      </View>
                      <Text style={styles.forwardChatName}>{r.name}</Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}
              {isGroup && (
                <TouchableOpacity style={styles.addParticipantBtn} onPress={() => {
                  setEditingGroupName(true);
                  setNewGroupName(chatDocName || '');
                }}>
                  <Ionicons name="pencil-outline" size={20} color={colors.accent} />
                  <Text style={styles.addParticipantText}>Editar nome do grupo</Text>
                </TouchableOpacity>
              )}
              {editingGroupName && (
                <View style={styles.editNameRow}>
                  <TextInput
                    style={styles.groupSearchInput}
                    value={newGroupName}
                    onChangeText={setNewGroupName}
                    placeholder="Novo nome do grupo"
                    placeholderTextColor={colors.textMuted}
                    autoFocus
                  />
                  <TouchableOpacity onPress={async () => {
                    if (!newGroupName.trim()) return;
                    try {
                      await db.collection('chats').doc(chatId).update({ name: newGroupName.trim() });
                      await db.collection('groups').doc(chatId).update({ name: newGroupName.trim() }).catch(() => {});
                      setChatDocName(newGroupName.trim());
                      setEditingGroupName(false);
                    } catch { Alert.alert('Erro', 'Não foi possível alterar o nome'); }
                  }}>
                    <Text style={styles.saveNameText}>Salvar</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: 16,
  },
  messageListCenter: {
    flex: 1,
    justifyContent: 'center',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 16,
    marginTop: 12,
    fontWeight: '600',
  },
  emptySubtext: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  errorText: {
    color: colors.destructive,
    fontSize: 15,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  myMessageRow: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  mediaBubble: {
    maxWidth: '82%',
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  myBubble: {
    backgroundColor: colors.accentDeep,
  },
  otherBubble: {
    backgroundColor: colors.elevated,
  },
  emojiBubble: {
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  messageText: {
    color: colors.text,
    fontSize: 15,
  },
  myMessageText: {
    color: colors.text,
  },
  emojiMessageText: {
    fontSize: 42,
    lineHeight: 52,
    textAlign: 'center',
    paddingVertical: 4,
  },
  mediaImage: {
    width: '100%',
    aspectRatio: 1.33,
    borderRadius: 8,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  sendingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  sendingText: {
    color: colors.white,
    fontSize: 12,
  },
  downloadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  downloadingText: {
    color: colors.white,
    fontSize: 11,
  },
  downloadingBarTrack: {
    width: '60%',
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  downloadingBarFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  uploadingIndicator: {
    padding: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: colors.surface,
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  attachButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.elevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 2,
  },
  attachText: {
    color: colors.textMuted,
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: -2,
  },
  emojiButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.elevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 2,
  },
  emojiButtonText: {
    fontSize: 18,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    backgroundColor: colors.elevated,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  emojiItem: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiText: {
    fontSize: 22,
  },
  viewOnceButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.elevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 2,
  },
  viewOnceButtonMedia: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewOnceButtonActive: {
    backgroundColor: colors.accent,
  },
  viewOnceButtonText: {
    fontSize: 16,
    opacity: 0.5,
  },
  viewOnceButtonTextActive: {
    opacity: 1,
  },
  stickerBubble: {
    backgroundColor: 'transparent',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  deletedText: {
    color: colors.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
  },
  viewOnceBlur: {
    width: '100%',
    aspectRatio: 1.33,
    borderRadius: 8,
    backgroundColor: colors.elevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  viewOnceIcon: {
    fontSize: 40,
  },
  viewOnceLabel: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  viewOnceBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  viewOnceBadgeText: {
    color: colors.white,
    fontSize: 11,
  },
  viewOncePlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  viewOncePlaceholderText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  viewOnceHint: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
    fontStyle: 'italic',
  },
  input: {
    flex: 1,
    backgroundColor: colors.elevated,
    color: colors.text,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
  },
  mediaPreviewContainer: {
    flex: 1,
  },
  mediaPreviewImageWrap: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1.4,
    maxHeight: 260,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
    backgroundColor: colors.elevated,
  },
  mediaPreviewImage: {
    width: '100%',
    height: '100%',
  },
  mediaPreviewCancel: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  viewOnceToggleBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    zIndex: 2,
  },
  viewOnceToggleBtnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  viewOnceToggleNum: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    opacity: 0.7,
  },
  viewOnceToggleNumActive: {
    opacity: 1,
  },
  mediaInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mediaInput: {
    flex: 1,
    backgroundColor: colors.elevated,
    color: colors.text,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
  },
  sendMediaButton: {
    backgroundColor: colors.accent,
    borderRadius: 18,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendIconButton: {
    marginLeft: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  micButton: {
    marginLeft: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.elevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  recordingContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingIndicator: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.elevated,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ff4444',
  },
  recordingTime: {
    color: colors.text,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  replyQuote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    paddingLeft: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderRadius: 6,
  },
  replyQuoteMine: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  replyBar: {
    width: 4,
    height: 28,
    backgroundColor: colors.accent,
    borderRadius: 2,
    marginRight: 8,
  },
  replyContent: {
    flex: 1,
  },
  replyName: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: 'bold',
  },
  replyText: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  replyPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    gap: 8,
  },
  replyPreviewBar: {
    width: 4,
    height: 32,
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  replyPreviewContent: {
    flex: 1,
  },
  replyPreviewName: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: 'bold',
  },
  replyPreviewText: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  replyCloseButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  reactionBarOverlay: {
    position: 'absolute',
    zIndex: 10,
    top: -48,
  },
  reactionBarOverlayMine: {
    right: 0,
  },
  reactionBarOverlayOther: {
    left: 0,
  },
  reactionBadgeRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  reactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 2,
    gap: 2,
  },
  reactionBadgeEmoji: {
    fontSize: 12,
  },
  reactionBadgeCount: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  stickerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerAnim: {
    width: 120,
    height: 120,
  },
  swipeContainer: {
    position: 'relative',
  },
  replyIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    zIndex: 1,
  },
  replyIndicatorText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  forwardModal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '60%',
    paddingBottom: 24,
  },
  forwardModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  forwardModalTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
  },
  forwardEmpty: {
    padding: 40,
    alignItems: 'center',
  },
  forwardChatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  forwardAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  forwardAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  forwardChatName: {
    color: colors.text,
    fontSize: 16,
  },
  groupInfoSection: {
    padding: 16,
  },
  groupInfoLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  groupParticipantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  removeParticipantBtn: {
    marginLeft: 'auto',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addParticipantBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    marginTop: 8,
  },
  addParticipantText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '500',
  },
  groupSearchInput: {
    backgroundColor: colors.elevated,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
    marginTop: 8,
  },
  editNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveNameText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  readStatusRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 2,
  },
  readStatusText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  readStatusRead: {
    color: colors.accent,
  },
  forwardedLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontStyle: 'italic',
    marginBottom: 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginVertical: 8,
    backgroundColor: colors.elevated,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    paddingVertical: 0,
  },
});
