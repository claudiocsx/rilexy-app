import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Animated,
  AccessibilityInfo,
  PanResponder,
} from 'react-native';
import { AudioRecorder, requestRecordingPermissionsAsync, setAudioModeAsync, RecordingPresets } from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../services/firebase';
import firebase from 'firebase/compat/app';
import { useAuth } from '../contexts/AuthContext';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useMediaPicker } from '../hooks/useMediaPicker';
import { uploadChatMedia } from '../services/storage';
import { getMediaUri } from '../services/mediaCache';
import { colors } from '../theme/colors';
import { useSettingsStore } from '../store/settingsStore';
import MediaViewer from '../components/MediaViewer';
import AudioMessage from '../components/AudioMessage';

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
}

function MessageBubble({ item, user, isEmojiOnly, uploadingMessages, cachedUris, onLongPress, onViewOnceMedia, onReply, onViewMedia }: MessageBubbleProps) {
  const mountedRef = useRef(true);
  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

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
  const displayUri = isUploading && localUri ? localUri : isRemoteUrl && cachedUri ? cachedUri : item.mediaUrl;

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

  return (
    <View style={styles.swipeContainer} {...panResponder.panHandlers}>
      <Animated.View style={[styles.replyIndicator, { opacity: replyIndicatorOpacity }]}>
        <Ionicons name="arrow-forward" size={20} color="#fff" />
        <Text style={styles.replyIndicatorText}>Responder</Text>
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX: swipeTranslate }] }}>
    <TouchableOpacity
      style={[styles.messageRow, isMine && styles.myMessageRow]}
      onLongPress={() => onLongPress(itemRef.current)}
      delayLongPress={400}
      activeOpacity={0.8}
    >
      <View style={[styles.messageBubble, isMine ? styles.myBubble : styles.otherBubble, isEmojiMsg && styles.emojiBubble]}>
        {item.replyTo && renderReplyPreview()}
        {wasViewedOnce ? (
          <View style={styles.viewOncePlaceholder}>
            <Text style={styles.viewOncePlaceholderText}>Visualização única</Text>
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
            <TouchableOpacity onPress={() => onViewMedia(displayUri)} activeOpacity={0.8}>
              <Image
                source={{ uri: displayUri }}
                style={styles.mediaImage}
                resizeMode="cover"
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
            {isRemoteUrl && !cachedUri && (
              <View style={styles.sendingOverlay}>
                <ActivityIndicator color={colors.white} />
                <Text style={styles.sendingText}>Baixando...</Text>
              </View>
            )}
          </View>
        ) : isUploading ? (
          <ActivityIndicator color={colors.accent} style={styles.uploadingIndicator} />
        ) : isRemoteUrl && !cachedUri ? (
          <ActivityIndicator color={colors.accent} style={styles.uploadingIndicator} />
        ) : null}
        {item.audioUrl && item.audioUrl !== '__uploading__' ? (
          <AudioMessage uri={item.audioUrl} duration={item.duration || 0} isMine={isMine} />
        ) : item.audioUrl === '__uploading__' ? (
          <ActivityIndicator color={colors.accent} style={styles.uploadingIndicator} />
        ) : null}
        {item.deletedForEveryone ? (
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
  mediaType?: string;
  senderId: string;
  senderName?: string;
  timestamp: any;
  participants: string[];
  deletedFor?: string[];
  deletedForEveryone?: boolean;
  viewOnce?: boolean;
  viewedOnceBy?: string[];
  audioUrl?: string;
  duration?: number;
  replyTo?: {
    id: string;
    text?: string;
    senderId: string;
    senderName: string;
    mediaUrl?: string;
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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [viewOnceMode, setViewOnceMode] = useState(false);
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);
  const autoDownload = useSettingsStore((s) => s.autoDownload);
  const flatListRef = useRef<FlatList>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { pickFromGallery, takePhoto, loading: mediaLoading } = useMediaPicker();

  useEffect(() => {
    const chatRef = db.collection('chats').doc(chatId);
    chatRef.get().then((doc) => {
      if (doc.exists) {
        setParticipants(doc.data()?.participants || []);
      }
    }).catch((e) => {
      console.error('Chat doc fetch error:', e);
      setError('Erro ao carregar conversa');
    });
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

  useEffect(() => {
    if (!user || !peerId) return;
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', gap: 16, marginRight: 4 }}>
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
  }, [user, peerId, peerName, navigation]);

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
    if (!text.trim() || !user || participants.length === 0) return;
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
    if (!selectedMedia || !user || participants.length === 0) return;

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
        viewOnce: isViewOnce || undefined,
        timestamp: new Date(),
        replyTo: replyData,
      });

      setUploadingMessages((prev) => ({ ...prev, [docRef.id]: media.uri }));

      const publicUrl = await uploadChatMedia(chatId, docRef.id, media.uri);
      if (publicUrl) {
        await db.collection('chats').doc(chatId).collection('messages').doc(docRef.id).update({ mediaUrl: publicUrl });
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
      setSelectedMedia(media);
    }
  }, [pickFromGallery]);

  const handleCancelMedia = useCallback(() => {
    setSelectedMedia(null);
    setViewOnceMode(false);
  }, []);

  const handleLongPress = useCallback((msg: Message) => {
    const isMine = msg.senderId === user?.uid;
    if (!isMine) return;

    setSelectedMsgId(msg.id);
    const options = ['Apagar para mim'];
    if (!msg.viewOnce) {
      options.push('Apagar para todos');
    }
    options.push('Cancelar');

    Alert.alert('Apagar mensagem', '', [
      { text: 'Apagar para mim', onPress: () => handleDeleteForMe(msg.id) },
      ...(msg.viewOnce ? [] : [{ text: 'Apagar para todos' as const, onPress: () => {
        Alert.alert(
          'Apagar para todos?',
          'Esta mensagem será apagada para todos os participantes. Esta ação não pode ser desfeita.',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Apagar', style: 'destructive', onPress: () => handleDeleteForEveryone(msg.id) },
          ]
        );
      }}]),
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }, [user]);

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

  const handleDeleteForEveryone = async (messageId: string) => {
    try {
      await db.collection('chats').doc(chatId).collection('messages').doc(messageId).update({
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
    if (!user || participants.length === 0) return;
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
    />
  );

  const visibleMessages = messages.filter(
    (m) => !(m.deletedFor?.includes(user?.uid || ''))
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        ref={flatListRef}
        data={visibleMessages}
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
        {showEmojiPicker && (
          <View style={styles.emojiGrid}>
            {EMOJIS.map((emoji, idx) => (
              <TouchableOpacity key={idx} style={styles.emojiItem} onPress={() => { setText((prev) => prev + emoji); setShowEmojiPicker(false); }}>
                <Text style={styles.emojiText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <TouchableOpacity style={styles.attachButton} onPress={handlePickMedia} disabled={mediaLoading}>
          <Text style={styles.attachText}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.emojiButton} onPress={() => setShowEmojiPicker(!showEmojiPicker)}>
          <Text style={styles.emojiButtonText}>😊</Text>
        </TouchableOpacity>
        {selectedMedia ? (
          <View style={styles.mediaPreviewContainer}>
            <Image source={{ uri: selectedMedia.uri }} style={styles.mediaPreview} />
            <TouchableOpacity style={styles.cancelMediaButton} onPress={handleCancelMedia}>
              <Text style={styles.cancelMediaText}>X</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewOnceButtonMedia, viewOnceMode && styles.viewOnceButtonActive]}
              onPress={() => setViewOnceMode(!viewOnceMode)}
            >
              <Text style={[styles.viewOnceButtonText, viewOnceMode && styles.viewOnceButtonTextActive]}>👁️</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.mediaInput}
              placeholder="Adicione uma legenda..."
              placeholderTextColor={colors.textMuted}
              value={text}
              onChangeText={setText}
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
              onChangeText={setText}
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
    width: 200,
    height: 150,
    borderRadius: 8,
    marginBottom: 4,
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
  deletedText: {
    color: colors.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
  },
  viewOnceBlur: {
    width: 200,
    height: 150,
    borderRadius: 8,
    backgroundColor: colors.elevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  viewOnceIcon: {
    fontSize: 32,
  },
  viewOnceLabel: {
    color: colors.accent,
    fontSize: 14,
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
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  viewOncePlaceholderText: {
    color: colors.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mediaPreview: {
    width: 40,
    height: 40,
    borderRadius: 6,
  },
  cancelMediaButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.destructive,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: -6,
    left: -6,
    zIndex: 1,
  },
  cancelMediaText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: 'bold',
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
  sendButton: {
    marginLeft: 8,
    backgroundColor: colors.accent,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
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
});
