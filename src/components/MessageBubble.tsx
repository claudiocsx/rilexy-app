import { useState, useEffect, useRef, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
  PanResponder,
  Pressable,
  AccessibilityInfo,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useDecryptedMedia } from '../hooks/useDecryptedMedia';
import AvatarImage from './AvatarImage';
import AudioMessage from './AudioMessage';
import PollMessage from './PollMessage';
import ReactionBar from './ReactionBar';
import { getColors } from '../theme/colors';
import { useSettingsStore } from '../store/settingsStore';
import LottieView from 'lottie-react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';

function isEmojiOnly(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  for (const ch of t) {
    const code = ch.codePointAt(0)!;
    if (code < 0x800) return false;
  }
  return true;
}

function VideoStickerItem({ videoUrl, trimStart, trimEnd, s }: { videoUrl: string; trimStart?: number; trimEnd?: number; s: ReturnType<typeof getStyles> }) {
  const player = useVideoPlayer({ uri: videoUrl }, (p) => {
    p.loop = true;
    p.muted = true;
    if (trimStart != null) p.currentTime = trimStart;
    p.play();
  });
  useEffect(() => {
    if (trimEnd == null || trimStart == null) return;
    const interval = setInterval(() => {
      if (player.currentTime >= trimEnd) player.currentTime = trimStart;
    }, 200);
    return () => clearInterval(interval);
  }, [player, trimStart, trimEnd]);
  return (
    <View style={s.stickerAnim}>
      <VideoView
        player={player}
        style={{ width: 120, height: 120 }}
        nativeControls={false}
        contentFit="contain"
      />
    </View>
  );
}

function isLightColor(hex?: string): boolean {
  if (!hex) return false;
  const color = hex.replace('#', '');
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);
  return (r * 0.299 + g * 0.587 + b * 0.114) > 160;
}

function renderMentionText(text: string, mentions: { userId: string; name: string }[] | undefined, c: ReturnType<typeof getColors>): React.ReactNode[] {
  if (!mentions || mentions.length === 0) {
    return [text];
  }
  const parts: React.ReactNode[] = [];
  let remaining = text;
  for (const m of mentions) {
    const pattern = '@' + m.name;
    if (!remaining.includes(pattern)) continue;
    const idx = remaining.indexOf(pattern);
    if (idx > 0) {
      parts.push(<Text key={`t-${parts.length}`}>{remaining.slice(0, idx)}</Text>);
    }
    parts.push(<Text key={`m-${parts.length}`} style={{ color: c.accent, fontWeight: '600' }}>{pattern}</Text>);
    remaining = remaining.slice(idx + pattern.length);
  }
  if (remaining.length > 0) {
    parts.push(<Text key={`t-${parts.length}`}>{remaining}</Text>);
  }
  return parts.length > 0 ? parts : [text];
}

function EmojiMessage({ text, isMine, s }: { text: string; isMine: boolean; s: ReturnType<typeof getStyles> }) {
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
        s.emojiMessageText,
        isMine && s.myMessageText,
        { transform: [{ scale: pulseAnim }] },
      ]}
    >
      {text}
    </Animated.Text>
  );
}

function DownloadProgress({ s }: { s: ReturnType<typeof getStyles> }) {
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
    <View style={s.downloadingBarTrack}>
      <Animated.View style={[s.downloadingBarFill, { width }]} />
    </View>
  );
}

function StickerMessage({ sticker, s }: { sticker: NonNullable<Message['sticker']>; s: ReturnType<typeof getStyles> }) {
  const [lottieFailed, setLottieFailed] = useState(false);
  return (
    <View style={s.stickerContainer}>
      {sticker.videoUrl ? (
        <VideoStickerItem videoUrl={sticker.videoUrl} trimStart={sticker.trimStart} trimEnd={sticker.trimEnd} s={s} />
      ) : lottieFailed ? (
        <Text style={{ fontSize: 48, textAlign: 'center' }}>{sticker.emoji}</Text>
      ) : (
        <LottieView
          source={{ uri: sticker.lottieUrl }}
          style={s.stickerAnim}
          autoPlay
          loop
          resizeMode="contain"
          onError={() => setLottieFailed(true)}
        />
      )}
    </View>
  );
}

function formatTime(timestamp: any): string {
  if (!timestamp) return '';
  try {
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

export interface Message {
  id: string;
  text?: string;
  mediaUrl?: string;
  mediaKey?: string;
  mediaIv?: string;
  mediaType?: string;
  senderId: string;
  senderName?: string;
  senderPhoto?: string | null;
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
  edited?: boolean;
  editedAt?: any;
  fileName?: string;
  fileSize?: number;
  linkPreview?: {
    url: string;
    title: string;
    description: string;
    image: string;
    siteName: string;
  };
  timerExpiresAt?: any;
  poll?: {
    question: string;
    options: { text: string; votes: string[] }[];
    totalVotes: number;
  };
  location?: {
    latitude: number;
    longitude: number;
  };
  mentions?: { userId: string; name: string }[];
  sticker?: { id: string; emoji: string; name: string; lottieUrl: string; videoUrl?: string; trimStart?: number; trimEnd?: number };
  textSticker?: { text: string; bgColor: string; emoji?: string };
  pinned?: boolean;
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
  storyContext?: {
    type: 'reaction' | 'reply';
    emoji?: string;
    preview?: {
      mediaUrl?: string;
      mediaType?: 'image' | 'video';
      text?: string;
      bgColor?: string;
    };
  };
  storyAuthorId?: string;
  storyAuthorName?: string;
  sharedPost?: {
    postId: string;
    senderName: string;
    text: string;
    mediaType?: string;
  };
}

interface MessageBubbleProps {
  item: Message;
  user: { uid: string };
  chatId: string;
  uploadingMessages: Record<string, string>;
  cachedUris: Record<string, string>;
  onLongPress: (msg: Message) => void;
  onViewOnceMedia: (msg: Message) => void;
  onReply: (msg: Message | null) => void;
  onViewMedia: (uri: string) => void;
  onReact: (msgId: string, emoji: string, currentReactions: { [emoji: string]: string[] } | undefined, senderId?: string) => void;
  consecutive?: boolean;
  isGroup?: boolean;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

const MessageBubble = memo(function MessageBubble({ item, user, chatId, uploadingMessages, cachedUris, onLongPress, onViewOnceMedia, onReply, onViewMedia, onReact, consecutive = false, isGroup = false, selectMode = false, selected = false, onToggleSelect }: MessageBubbleProps) {
  const theme = useSettingsStore((s) => s.theme);
  const c = getColors(theme);
  const s = getStyles(c);
  const mountedRef = useRef(true);
  useEffect(() => { return () => { mountedRef.current = false; }; }, []);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showReactions, setShowReactions] = useState(false);

  const itemRef = useRef(item);
  itemRef.current = item;
  const onReplyRef = useRef(onReply);
  onReplyRef.current = onReply;
  const onReactRef = useRef(onReact);
  onReactRef.current = onReact;
  const lastTapRef = useRef(0);
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

  const reactionScale = useRef(new Animated.Value(0)).current;
  const reactionOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (showReactions) {
      reactionScale.setValue(0.8);
      reactionOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(reactionScale, { toValue: 1, useNativeDriver: true }),
        Animated.timing(reactionOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [showReactions]);

  const isDeletedForMe = (msg: Message): boolean => {
    if (msg.deletedFor?.includes(user.uid)) return true;
    return false;
  };

  const isMine = item.senderId === user.uid;
  const isEmojiMsg = item.text ? isEmojiOnly(item.text) : false;
  const [expanded, setExpanded] = useState(false);
  const isLong = (item.text?.length || 0) > 200;
  const displayText = isLong && !expanded ? item.text?.slice(0, 200) + '...' : item.text;
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

  if (isDeletedForMe(item)) return null;

  const isViewOnceMedia = item.viewOnce && item.mediaUrl && item.mediaUrl !== '__uploading__';
  const wasViewedOnce = isViewOnceMedia && item.viewedOnceBy?.includes(user.uid) && item.senderId !== user.uid;

  const renderReplyPreview = () => {
    const fromName = item.senderId === user.uid ? 'Você' : (item.replyTo?.senderName || '');
    const replyContent = item.replyTo?.text || (item.replyTo?.audioUrl ? '🎤 Áudio' : item.replyTo?.mediaUrl ? '📷 Mídia' : '');
    return (
      <View style={[s.replyQuote, isMine && s.replyQuoteMine]}>
        <View style={s.replyBar} />
        <View style={s.replyContent}>
          <Text style={s.replyName}>{fromName}</Text>
          <Text style={s.replyText} numberOfLines={2}>{replyContent}</Text>
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
    onReact(item.id, emoji, item.reactions, item.senderId);
    setShowReactions(false);
  };

  const handleMorePress = () => {
    setShowReactions(false);
    onLongPress(itemRef.current);
  };

  const renderBubbleContent = () => (
    <>
      {isGroup && !isMine && !consecutive && (
        <Text style={s.senderName}>{item.senderName || 'Usuário'}</Text>
      )}
      {item.replyTo && renderReplyPreview()}
      {item.forwarded && (
        <Text style={s.forwardedLabel}>Encaminhada</Text>
      )}
      {item.sharedPost && (
        <View style={s.sharedPostCard}>
          <View style={s.sharedPostHeader}>
            <Ionicons name="person-circle-outline" size={16} color={c.accent} />
            <Text style={s.sharedPostAuthor} numberOfLines={1}>{item.sharedPost.senderName}</Text>
          </View>
          {item.sharedPost.text ? (
            <Text style={s.sharedPostText} numberOfLines={3}>{item.sharedPost.text}</Text>
          ) : null}
          <Text style={s.sharedPostLabel}>Post do feed</Text>
        </View>
      )}
      {item.storyContext && (
        <View style={s.storyPreviewContainer}>
          {item.storyContext.preview?.mediaUrl ? (
            <View style={s.storyPreviewThumb}>
              <Image source={{ uri: item.storyContext.preview.mediaUrl }} style={s.storyPreviewImg} contentFit="cover" />
            </View>
          ) : item.storyContext.preview?.bgColor ? (
            <View style={[s.storyPreviewThumb, { backgroundColor: item.storyContext.preview.bgColor, justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={{ fontSize: 24, color: isLightColor(item.storyContext.preview.bgColor) ? '#1a1a2e' : '#fff' }}>
                {item.storyContext.preview.text || ''}
              </Text>
            </View>
          ) : null}
          <Text style={s.storyChipText}>
            {item.storyContext.type === 'reaction' ? 'Reagiu ao momento' : 'Respondeu ao momento'}
          </Text>
        </View>
      )}
      {wasViewedOnce ? (
        <View style={s.viewOncePlaceholder}>
          <Ionicons name="eye-outline" size={16} color={c.textMuted} />
          <Text style={s.viewOncePlaceholderText}>Aberta</Text>
        </View>
      ) : isViewOnceMedia && item.senderId !== user.uid ? (
        <TouchableOpacity onPress={() => onViewOnceMedia(item)} activeOpacity={0.7}>
          <View style={s.viewOnceBlur}>
            <Ionicons name="eye-outline" size={40} color={c.textMuted} />
            <Text style={s.viewOnceLabel}>Toque para ver</Text>
          </View>
        </TouchableOpacity>
      ) : item.mediaType === 'document' && displayUri && displayUri !== '__uploading__' ? (
        <View style={s.documentContainer}>
          <Ionicons name="document-text-outline" size={32} color={c.accent} />
          <Text style={s.documentName} numberOfLines={2}>{item.fileName || 'Documento'}</Text>
          {item.fileSize ? (
            <Text style={s.documentSize}>
              {item.fileSize < 1024 * 1024
                ? `${(item.fileSize / 1024).toFixed(0)} KB`
                : `${(item.fileSize / (1024 * 1024)).toFixed(1)} MB`}
            </Text>
          ) : null}
          {isUploading && (
            <View style={s.sendingOverlay}>
              <ActivityIndicator color={c.white} />
              <Text style={s.sendingText}>Enviando...</Text>
            </View>
          )}
        </View>
      ) : (isViewOnceMedia || item.viewOnce) && isMine ? (
        <View style={s.viewOnceSenderBadge}>
          <Ionicons name="eye-outline" size={14} color={c.textMuted} />
          <Text style={s.viewOnceSenderBadgeLabel}>Visualização única</Text>
        </View>
      ) : displayUri && displayUri !== '__uploading__' && item.mediaType !== 'document' ? (
        <View>
          <TouchableOpacity onPress={() => onViewMedia(decryptedUri || displayUri)} activeOpacity={0.8}>
            <Image
              source={displayUri}
              style={s.mediaImage}
              contentFit="cover"
              transition={200}
            />
          </TouchableOpacity>
          {isUploading && (
            <View style={s.sendingOverlay}>
              <ActivityIndicator color={c.white} />
              <Text style={s.sendingText}>Enviando...</Text>
            </View>
          )}
          {isRemoteUrl && decrypting && (
            <View style={s.downloadingOverlay}>
              <DownloadProgress s={s} />
              <Text style={s.downloadingText}>Baixando...</Text>
            </View>
          )}
        </View>
      ) : isUploading ? (
        <ActivityIndicator color={c.accent} style={s.uploadingIndicator} />
      ) : isRemoteUrl && decrypting ? (
        <ActivityIndicator color={c.accent} style={s.uploadingIndicator} />
      ) : null}
      {item.audioUrl && item.audioUrl !== '__uploading__' ? (
        item.viewOnce && !isMine ? (
          item.viewedOnceBy?.includes(user.uid) ? (
            <View style={s.viewOnceAudioPlaceholder}>
              <Ionicons name="eye-outline" size={16} color={c.textMuted} />
              <Text style={s.viewOnceAudioPlaceholderText}>Aberta</Text>
            </View>
          ) : (
            <TouchableOpacity onPress={() => onViewOnceMedia(item)} activeOpacity={0.7}>
              <View style={s.viewOnceAudioBlur}>
                <Ionicons name="musical-note" size={28} color={c.textMuted} />
                <Text style={s.viewOnceAudioLabel}>Toque para ouvir</Text>
              </View>
            </TouchableOpacity>
          )
        ) : (
          <View>
            <AudioMessage uri={item.audioUrl} duration={item.duration || 0} isMine={isMine} />
            {item.viewOnce && isMine && (
              <View style={s.viewOnceBadge}>
                <Ionicons name="eye-outline" size={11} color={c.white} />
                <Text style={s.viewOnceBadgeText}> 1</Text>
              </View>
            )}
          </View>
        )
      ) : item.audioUrl === '__uploading__' ? (
        <ActivityIndicator color={c.accent} style={s.uploadingIndicator} />
      ) : null}
      {item.poll ? (
        <PollMessage poll={item.poll} messageId={item.id} chatId={chatId} userId={user.uid} isMine={isMine} />
      ) : null}
      {item.location ? (
        <View style={s.locationContainer}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 10, gap: 8 }}>
            <Ionicons name="location-outline" size={20} color={c.accent} />
            <Text style={{ color: c.text, fontSize: 13 }}>
              {item.location.latitude.toFixed(5)}, {item.location.longitude.toFixed(5)}
            </Text>
          </View>
        </View>
      ) : null}
      {item.linkPreview && item.linkPreview.title ? (
        <View style={s.linkPreviewContainer}>
          {item.linkPreview.image ? (
            <Image source={{ uri: item.linkPreview.image }} style={s.linkPreviewImage} contentFit="cover" />
          ) : null}
          <View style={s.linkPreviewText}>
            {item.linkPreview.siteName ? (
              <Text style={s.linkPreviewSiteName} numberOfLines={1}>{item.linkPreview.siteName}</Text>
            ) : null}
            <Text style={s.linkPreviewTitle} numberOfLines={2}>{item.linkPreview.title}</Text>
            {item.linkPreview.description ? (
              <Text style={s.linkPreviewDesc} numberOfLines={2}>{item.linkPreview.description}</Text>
            ) : null}
          </View>
        </View>
      ) : null}
      {item.sticker ? (
        <StickerMessage sticker={item.sticker} s={s} />
      ) : item.textSticker ? (
        <View style={[s.textStickerContainer, { backgroundColor: item.textSticker.bgColor }]}>
          {item.textSticker.emoji ? <Text style={s.textStickerEmoji}>{item.textSticker.emoji}</Text> : null}
          <Text style={s.textStickerText}>{item.textSticker.text}</Text>
        </View>
      ) : item.deletedForEveryone ? (
        <Text style={s.deletedText}>Mensagem apagada</Text>
      ) : item.text ? (
        isEmojiOnly(item.text) ? (
          <EmojiMessage text={displayText || ''} isMine={isMine} s={s} />
        ) : (
          <>
            <Text style={[s.messageText, isMine && s.myMessageText]}>
              {item.mentions ? renderMentionText(displayText || '', item.mentions, c) : displayText}
            </Text>
            {isLong && !expanded && (
              <TouchableOpacity onPress={() => setExpanded(true)}>
                <Text style={{ color: c.accent, fontSize: 13, marginTop: 2 }}>Ler mais</Text>
              </TouchableOpacity>
            )}
          </>
        )
      ) : null}
      {item.edited && <Text style={s.editedIndicator}>Editada</Text>}
      {item.viewOnce && !item.mediaUrl && !item.audioUrl && (
        <Text style={s.viewOnceHint}>Visualização única</Text>
      )}
      {(item.timerExpiresAt || item.viewOnce) && (
        <View style={s.timerBadgeRow}>
          {item.timerExpiresAt && <Ionicons name="timer-outline" size={12} color={c.textMuted} />}
          {item.viewOnce && <Ionicons name="eye-outline" size={12} color={c.textMuted} />}
        </View>
      )}
      <View style={s.metaRow}>
        {item.timestamp && (
          <Text style={[s.timestamp, isMine && s.timestampMine]}>
            {formatTime(item.timestamp)}
          </Text>
        )}
        {isMine && (
          <Ionicons
            name={(item.readBy || []).filter((id) => id !== user.uid).length > 0 ? 'checkmark-done' : 'checkmark'}
            size={14}
            color={(item.readBy || []).filter((id) => id !== user.uid).length > 0 ? '#53bdeb' : c.textMuted}
          />
        )}
      </View>
    </>
  );

  return (
    <View style={s.swipeContainer} {...panResponder.panHandlers}>
      <Animated.View style={[s.replyIndicator, { opacity: replyIndicatorOpacity }]}>
        <Ionicons name="arrow-forward" size={20} color={c.white} />
        <Text style={s.replyIndicatorText}>Responder</Text>
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX: swipeTranslate }] }}>
        <View style={[s.messageRow, isMine && s.myMessageRow, consecutive && s.messageRowConsecutive]}>
          {!isMine && isGroup && !selectMode && (
            consecutive ? (
              <View style={{ width: 36, marginRight: 8 }} />
            ) : (
              <View style={{ marginRight: 8, alignSelf: 'flex-end' }}>
                <AvatarImage photoURL={item.senderPhoto} name={item.senderName || '?'} size={36} />
              </View>
            )
          )}
          {selectMode && (
            <TouchableOpacity onPress={() => onToggleSelect?.(item.id)} style={s.selectCheckbox}>
              <Ionicons name={selected ? 'checkbox' : 'square-outline'} size={22} color={selected ? c.accent : c.textMuted} />
            </TouchableOpacity>
          )}
          <View style={[s.bubbleWrapper, consecutive && s.bubbleWrapperConsecutive]}>
            {!isMine && !consecutive && !isEmojiMsg && !item.sticker && !item.textSticker && <View style={[s.tail, s.tailLeft]} />}
            {showReactions && (
              <>
                <Pressable style={s.reactionBackdrop} onPress={() => setShowReactions(false)} />
                <Animated.View style={[{ position: 'absolute', top: -52, zIndex: 100 }, isMine ? { right: 0 } : { left: 0 }, { opacity: reactionOpacity, transform: [{ scale: reactionScale }] }]}>
                  <ReactionBar onReact={handleReactionTap} userReactions={userReactions} onMorePress={handleMorePress} />
                </Animated.View>
              </>
            )}
    <View>
      <Pressable
        onPress={() => {
          if (selectMode && onToggleSelect) {
            onToggleSelect(item.id);
            return;
          }
          const now = Date.now();
          if (now - lastTapRef.current < 300) {
            lastTapRef.current = 0;
            const reactFn = onReactRef.current;
            if (reactFn && !isMine) {
              reactFn(item.id, '❤️', item.reactions, item.senderId);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            }
          } else {
            lastTapRef.current = now;
          }
        }}
        onLongPress={() => {
          if (selectMode) return;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); setShowReactions(true);
        }}
        delayLongPress={400}
      >
      {isEmojiMsg || item.sticker || item.textSticker ? (
        <View style={[s.messageBubble, isEmojiMsg ? s.emojiBubble : item.textSticker ? s.textStickerBubble : s.stickerBubble]}>
          {renderBubbleContent()}
        </View>
      ) : isMine ? (
        <LinearGradient colors={[c.accentDeep, c.accentDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.messageBubble, s.myBubble, item.mediaUrl && s.mediaBubble]}>
          {renderBubbleContent()}
        </LinearGradient>
      ) : (
        <LinearGradient colors={[c.elevated, c.surface]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.messageBubble, s.otherBubble, item.mediaUrl && s.mediaBubble]}>
          {renderBubbleContent()}
        </LinearGradient>
      )}
      </Pressable>
    </View>
            {item.reactions && (
              <View style={[s.reactionBadgeRow, isMine ? s.reactionBadgeRowMine : s.reactionBadgeRowOther]}>
                {Object.entries(item.reactions)
                  .filter(([, userIds]) => userIds.length > 0)
                  .sort(([, a], [, b]) => b.length - a.length)
                  .slice(0, 4)
                  .map(([emoji, userIds]) => (
                    <TouchableOpacity key={emoji} style={s.reactionBadge} onPress={() => handleReactionTap(emoji)} activeOpacity={0.6}>
                      <Text style={s.reactionBadgeEmoji}>{emoji}</Text>
                      {userIds.length > 1 && (
                        <Text style={s.reactionBadgeCount}>{userIds.length}</Text>
                      )}
                    </TouchableOpacity>
                  ))}
              </View>
            )}
            {isMine && !consecutive && !isEmojiMsg && !item.sticker && !item.textSticker && <View style={[s.tail, s.tailRight]} />}
          </View>
        </View>
    </Animated.View>
    </View>
  );
});

function getStyles(c: ReturnType<typeof getColors>) {
  return StyleSheet.create({
    swipeContainer: {
      position: 'relative',
    },
    bubbleWrapper: {
      position: 'relative',
      maxWidth: '75%',
    },
    tail: {
      position: 'absolute',
      top: 8,
      width: 10,
      height: 10,
      zIndex: -1,
    },
    tailLeft: {
      left: -5,
      backgroundColor: c.elevated,
      transform: [{ rotate: '45deg' }],
    },
    tailRight: {
      right: -5,
      backgroundColor: c.accentDeep,
      transform: [{ rotate: '45deg' }],
    },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: 4,
      marginTop: 4,
    },
    timestamp: {
      fontSize: 11,
      color: c.textMuted,
    },
    timestampMine: {
      color: 'rgba(255,255,255,0.5)',
    },
    replyIndicator: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 80,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: c.accent,
      borderTopLeftRadius: 12,
      borderBottomLeftRadius: 12,
      zIndex: 1,
    },
    replyIndicatorText: {
      color: c.white,
      fontSize: 12,
      marginTop: 2,
    },
    selectCheckbox: {
      paddingHorizontal: 8,
      justifyContent: 'center',
    },
    messageRow: {
      flexDirection: 'row',
      marginBottom: 4,
    },
    myMessageRow: {
      justifyContent: 'flex-end',
    },
    messageRowConsecutive: {
      marginBottom: 6,
    },
    bubbleWrapperConsecutive: {
      marginTop: 0,
    },
    messageBubble: {
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    mediaBubble: {
      paddingHorizontal: 4,
      paddingVertical: 4,
    },
    myBubble: {
      backgroundColor: c.accentDeep,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 4,
      borderBottomLeftRadius: 16,
      borderBottomRightRadius: 16,
      shadowColor: c.bg,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 4,
    },
    otherBubble: {
      backgroundColor: c.elevated,
      borderTopLeftRadius: 4,
      borderTopRightRadius: 16,
      borderBottomLeftRadius: 16,
      borderBottomRightRadius: 16,
      shadowColor: c.bg,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 3,
      elevation: 2,
    },
    emojiBubble: {
      backgroundColor: 'transparent',
      paddingHorizontal: 0,
      paddingVertical: 0,
    },
    messageText: {
      color: c.text,
      fontSize: 15,
    },
    myMessageText: {
      color: c.text,
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
      color: c.white,
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
      color: c.white,
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
      backgroundColor: c.accent,
      borderRadius: 2,
    },
    uploadingIndicator: {
      padding: 20,
    },
    stickerContainer: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    stickerAnim: {
      width: 120,
      height: 120,
    },
    stickerBubble: {
      backgroundColor: 'transparent',
      paddingHorizontal: 4,
      paddingVertical: 4,
    },
    textStickerBubble: {
      backgroundColor: 'transparent',
      paddingHorizontal: 2,
      paddingVertical: 2,
    },
    textStickerContainer: {
      borderRadius: 12,
      padding: 12,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 160,
      minHeight: 100,
    },
    textStickerEmoji: {
      fontSize: 36,
      marginBottom: 4,
    },
    textStickerText: {
      fontSize: 18,
      fontWeight: '600',
      color: '#FFFFFF',
      textAlign: 'center',
    },
    deletedText: {
      color: c.textMuted,
      fontSize: 13,
      fontStyle: 'italic',
    },
    editedIndicator: {
      color: c.textMuted,
      fontSize: 11,
      fontStyle: 'italic',
      marginTop: 2,
    },
    viewOnceBlur: {
      width: '100%',
      aspectRatio: 1.33,
      borderRadius: 8,
      backgroundColor: c.elevated,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 4,
      gap: 8,
    },
    viewOnceLabel: {
      color: c.accent,
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
      color: c.white,
      fontSize: 11,
    },
    viewOnceSenderBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 10,
      backgroundColor: c.elevated,
      borderRadius: 6,
      alignSelf: 'center',
    },
    viewOnceSenderBadgeLabel: {
      color: c.textMuted,
      fontSize: 12,
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
      color: c.textMuted,
      fontSize: 13,
    },
    viewOnceHint: {
      color: c.textMuted,
      fontSize: 11,
      marginTop: 2,
      fontStyle: 'italic',
    },
    viewOnceAudioBlur: {
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderRadius: 8,
      backgroundColor: c.elevated,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
      minWidth: 180,
    },
    viewOnceAudioLabel: {
      color: c.accent,
      fontSize: 14,
      fontWeight: '600',
    },
    viewOnceAudioPlaceholder: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    viewOnceAudioPlaceholderText: {
      color: c.textMuted,
      fontSize: 13,
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
      backgroundColor: c.accent,
      borderRadius: 2,
      marginRight: 8,
    },
    replyContent: {
      flex: 1,
    },
    replyName: {
      color: c.accent,
      fontSize: 13,
      fontWeight: 'bold',
    },
    replyText: {
      color: c.textMuted,
      fontSize: 12,
      marginTop: 2,
    },
    reactionBadgeRow: {
      position: 'absolute',
      flexDirection: 'row',
      gap: 2,
      zIndex: 50,
    },
    reactionBadgeRowMine: {
      bottom: -10,
      right: 0,
    },
    reactionBackdrop: {
      position: 'absolute',
      top: -200,
      left: -200,
      right: -200,
      bottom: -200,
      zIndex: 99,
    },
    reactionBadgeRowOther: {
      bottom: -10,
      left: 0,
    },
    reactionBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'transparent',
      borderRadius: 14,
      paddingHorizontal: 6,
      paddingVertical: 3,
      gap: 3,
    },
    reactionBadgeEmoji: {
      fontSize: 18,
    },
    reactionBadgeCount: {
      color: c.textMuted,
      fontSize: 10,
      fontWeight: '600',
    },
    timerBadgeRow: {
      flexDirection: 'row',
      gap: 4,
      marginTop: 2,
    },
    storyPreviewContainer: {
      marginBottom: 6,
      gap: 6,
    },
    storyPreviewThumb: {
      width: 64,
      height: 85,
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: c.border,
    },
    storyPreviewImg: {
      width: '100%',
      height: '100%',
    },
    storyChipText: {
      color: c.accent,
      fontSize: 11,
      fontWeight: '600',
    },
    senderName: {
    color: c.accent,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  forwardedLabel: {
      color: c.textMuted,
      fontSize: 11,
      fontStyle: 'italic',
      marginBottom: 2,
    },
    sharedPostCard: {
      borderWidth: 1,
      borderColor: c.accent,
      borderRadius: 10,
      padding: 10,
      marginBottom: 4,
      backgroundColor: 'rgba(167, 139, 250, 0.08)',
    },
    sharedPostHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 4,
    },
    sharedPostAuthor: {
      color: c.accent,
      fontSize: 12,
      fontWeight: '600',
      flex: 1,
    },
    sharedPostText: {
      color: c.text,
      fontSize: 13,
      lineHeight: 18,
      marginBottom: 4,
    },
    sharedPostLabel: {
      color: c.textMuted,
      fontSize: 10,
      fontStyle: 'italic',
    },
    documentContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 6,
      paddingHorizontal: 2,
    },
    documentName: {
      flex: 1,
      color: c.text,
      fontSize: 14,
      fontWeight: '500',
    },
    documentSize: {
      color: c.textMuted,
      fontSize: 12,
    },
    locationContainer: {
      borderRadius: 8,
      overflow: 'hidden',
      marginBottom: 4,
    },
    linkPreviewContainer: {
      borderRadius: 8,
      overflow: 'hidden',
      marginBottom: 4,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    linkPreviewImage: {
      width: '100%',
      height: 120,
    },
    linkPreviewText: {
      padding: 8,
      gap: 2,
    },
    linkPreviewSiteName: {
      color: c.textMuted,
      fontSize: 11,
      textTransform: 'uppercase',
    },
    linkPreviewTitle: {
      color: c.accent,
      fontSize: 14,
      fontWeight: '600',
    },
    linkPreviewDesc: {
      color: c.text,
      fontSize: 12,
      opacity: 0.7,
    },
  });
}

export default MessageBubble;
