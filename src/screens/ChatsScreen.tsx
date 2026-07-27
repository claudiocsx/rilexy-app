import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Animated,
  RefreshControl,
  Pressable,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Swipeable } from 'react-native-gesture-handler';
import AvatarImage from '../components/AvatarImage';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import firebase from 'firebase/compat/app';

type ChatNav = NativeStackNavigationProp<RootStackParamList>;

interface Chat {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastMessageTime?: any;
  lastMessageSender?: string;
  lastMessageReadBy?: string[];
  name?: string;
  isGroup?: boolean;
  typing?: Record<string, any>;
  pinnedAt?: Record<string, any>;
  mutedBy?: string[];
  unreadCount?: Record<string, number>;
  lastMessageType?: string;
  photoURL?: string;
}

function formatChatTime(ts: any): string {
  if (!ts) return '';
  let date: Date;
  if (ts?.toDate) {
    date = ts.toDate();
  } else if (ts?.seconds) {
    date = new Date(ts.seconds * 1000);
  } else if (typeof ts === 'string' || typeof ts === 'number') {
    date = new Date(ts);
  } else {
    return '';
  }
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const pad = (n: number) => n.toString().padStart(2, '0');
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;

  if (isToday) return time;
  if (isYesterday) return 'Ontem';
  if (diffH < 168) {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return days[date.getDay()];
  }
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
}

function getMediaPreview(lastMessage?: string, lastMessageType?: string): string | null {
  if (!lastMessage) return null;
  const msg = lastMessage.toLowerCase();
  if (lastMessageType === 'image' || msg.includes('[imagem]') || msg.includes('[foto]') || msg === '📷' || msg.startsWith('📷')) return '📷 Foto';
  if (lastMessageType === 'video' || msg.includes('[vídeo]') || msg.includes('[video]') || msg === '🎥' || msg.startsWith('🎥')) return '🎥 Vídeo';
  if (lastMessageType === 'audio' || msg.includes('[áudio]') || msg.includes('[audio]') || msg.includes('[mensagem de voz]') || msg === '🎤' || msg.startsWith('🎤')) return '🎤 Áudio';
  if (lastMessageType === 'sticker' || msg.includes('[figurinha]')) return '🎨 Figurinha';
  if (msg.includes('[post compartilhado]')) return '🔗 Post';
  if (msg.includes('[arquivo]') || msg.includes('[documento]')) return '📄 Arquivo';
  return null;
}

function getTypingText(typing?: Record<string, any>, currentUid?: string): string | null {
  if (!typing || !currentUid) return null;
  const now = Date.now();
  for (const [uid, ts] of Object.entries(typing)) {
    if (uid === currentUid) continue;
    let tsMs = 0;
    if (ts?.toDate) tsMs = ts.toDate().getTime();
    else if (ts?.seconds) tsMs = ts.seconds * 1000;
    else if (typeof ts === 'number') tsMs = ts;
    if (now - tsMs < 5000) return 'digitando...';
  }
  return null;
}

function SkeletonChat() {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <View style={styles.chatItem}>
      <Animated.View style={[styles.skeletonCircle, { opacity: pulse }]} />
      <View style={{ flex: 1, marginLeft: 12, gap: 8 }}>
        <Animated.View style={[styles.skeletonLine, { width: '55%', opacity: pulse }]} />
        <Animated.View style={[styles.skeletonLine, { width: '75%', opacity: pulse, height: 10 }]} />
      </View>
      <Animated.View style={[styles.skeletonLine, { width: 40, opacity: pulse, height: 10, borderRadius: 5 }]} />
    </View>
  );
}

export default function ChatsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<ChatNav>();
  const [chats, setChats] = useState<Chat[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [userPhotos, setUserPhotos] = useState<Record<string, string>>({});
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRetryKey((k) => k + 1);
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setError(null);
    return db.collection('chats')
      .where('participants', 'array-contains', user.uid)
      .orderBy('lastMessageTime', 'desc')
      .onSnapshot((snapshot) => {
        const chatsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Chat[];
        setChats(chatsData);
        setLoading(false);
        setError(null);
      }, (err) => {
        setLoading(false);
        setError('Erro ao carregar conversas');
        console.error('Chats onSnapshot error:', err);
      });
  }, [user, retryKey]);

  useEffect(() => {
    if (!user || chats.length === 0) return;
    const otherIds = chats
      .filter((c) => !c.name)
      .map((c) => c.participants.find((id) => id !== user.uid))
      .filter(Boolean) as string[];
    if (otherIds.length === 0) return;

    const uniqueIds = [...new Set(otherIds)].filter((id) => !userNames[id]);
    if (uniqueIds.length === 0) return;

    const fetchNames = async () => {
      try {
        const nameMap: Record<string, string> = {};
        const photoMap: Record<string, string> = {};
        const chunks: string[][] = [];
        for (let i = 0; i < uniqueIds.length; i += 10) chunks.push(uniqueIds.slice(i, i + 10));
        for (const chunk of chunks) {
          const snap = await db.collection('users').where('uid', 'in', chunk).get();
          snap.docs.forEach((doc) => {
            const data = doc.data();
            nameMap[doc.id] = data.displayName || 'Usuário';
            if (data.photoURL) photoMap[doc.id] = data.photoURL;
          });
        }
        setUserNames((prev) => ({ ...prev, ...nameMap }));
        setUserPhotos((prev) => ({ ...prev, ...photoMap }));
      } catch (e) {
        console.error('fetchNames error:', e);
      }
    };
    fetchNames();
  }, [chats, user]);

  useEffect(() => {
    if (!user || chats.length === 0) return;
    const allIds = new Set<string>();
    chats.forEach((c) => {
      c.participants.forEach((id) => {
        if (id !== user.uid) allIds.add(id);
      });
    });
    if (allIds.size === 0) return;

    const unsubs = [...allIds].map((uid) =>
      db.collection('presence').doc(uid).onSnapshot((doc) => {
        if (doc.exists && doc.data()?.online) {
          setOnlineUsers((prev) => new Set([...prev, uid]));
        } else {
          setOnlineUsers((prev) => {
            const next = new Set(prev);
            next.delete(uid);
            return next;
          });
        }
      }, () => {})
    );
    return () => unsubs.forEach((u) => u());
  }, [chats, user]);

  const getChatName = (chat: Chat): string => {
    if (chat.name) return chat.name;
    const otherId = chat.participants.find((id) => id !== user?.uid);
    return userNames[otherId || ''] || 'Usuário';
  };

  const getChatPhoto = (chat: Chat): string | null => {
    if (chat.photoURL) return chat.photoURL;
    if (chat.name) return null;
    const otherId = chat.participants.find((id) => id !== user?.uid);
    return userPhotos[otherId || ''] || null;
  };

  const getOtherUid = (chat: Chat): string | null => {
    if (chat.name) return null;
    return chat.participants.find((id) => id !== user?.uid) || null;
  };

  const getUnreadCount = (chat: Chat): number => {
    if (!user) return 0;
    if (chat.unreadCount?.[user.uid]) return chat.unreadCount[user.uid];
    if (chat.lastMessageSender === user.uid) return 0;
    const readBy = chat.lastMessageReadBy || [];
    if (readBy.includes(user.uid)) return 0;
    return chat.lastMessage ? 1 : 0;
  };

  const isReadByPeer = (chat: Chat): boolean => {
    if (!user) return false;
    if (chat.lastMessageSender === user.uid) {
      const readBy = chat.lastMessageReadBy || [];
      return readBy.some((id) => id !== user.uid);
    }
    return false;
  };

  const handleArchive = (chat: Chat) => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    db.collection('chats').doc(chat.id).update({
      hiddenFor: firebase.firestore.FieldValue.arrayUnion(user.uid),
    }).catch(() => {});
  };

  const handleToggleMute = (chat: Chat) => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const isMuted = (chat.mutedBy || []).includes(user.uid);
    db.collection('chats').doc(chat.id).update({
      mutedBy: isMuted
        ? firebase.firestore.FieldValue.arrayRemove(user.uid)
        : firebase.firestore.FieldValue.arrayUnion(user.uid),
    }).catch(() => {});
  };

  const handleMarkAsRead = (chat: Chat) => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    db.collection('chats').doc(chat.id).update({
      [`unreadCount.${user.uid}`]: 0,
      lastMessageReadBy: firebase.firestore.FieldValue.arrayUnion(user.uid),
    }).catch(() => {});
  };

  const handleTogglePin = (chat: Chat) => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const isPinned = chat.pinnedAt?.[user.uid];
    db.collection('chats').doc(chat.id).update({
      [`pinnedAt.${user.uid}`]: isPinned ? firebase.firestore.FieldValue.delete() : firebase.firestore.FieldValue.serverTimestamp(),
    }).catch(() => {});
  };

  const renderRightActions = (chat: Chat) => {
    const isMuted = (chat.mutedBy || []).includes(user?.uid || '');
    return (
      <View style={styles.swipeActions}>
        <Pressable
          onPress={() => handleTogglePin(chat)}
          style={[styles.swipeAction, { backgroundColor: colors.accent }]}
        >
          <Ionicons name="pin-outline" size={20} color={colors.white} />
          <Text style={styles.swipeActionText}>Fixar</Text>
        </Pressable>
        <Pressable
          onPress={() => handleToggleMute(chat)}
          style={[styles.swipeAction, { backgroundColor: isMuted ? colors.success : '#F59E0B' }]}
        >
          <Ionicons name={isMuted ? 'volume-high-outline' : 'volume-mute-outline'} size={20} color={colors.white} />
          <Text style={styles.swipeActionText}>{isMuted ? 'Desmutar' : 'Silenciar'}</Text>
        </Pressable>
        <Pressable
          onPress={() => handleArchive(chat)}
          style={[styles.swipeAction, { backgroundColor: '#6366F1' }]}
        >
          <Ionicons name="archive-outline" size={20} color={colors.white} />
          <Text style={styles.swipeActionText}>Arquivar</Text>
        </Pressable>
      </View>
    );
  };

  const sortedChats = useMemo(() => {
    if (!user) return chats;
    const pinned = chats.filter((c) => c.pinnedAt?.[user.uid]);
    const unpinned = chats.filter((c) => !c.pinnedAt?.[user.uid]);
    return [...pinned, ...unpinned];
  }, [chats, user]);

  const renderChat = ({ item }: { item: Chat }) => {
    const otherUid = getOtherUid(item);
    const isOnline = otherUid ? onlineUsers.has(otherUid) : false;
    const unread = getUnreadCount(item);
    const isPinned = item.pinnedAt?.[user?.uid || ''];
    const isMuted = (item.mutedBy || []).includes(user?.uid || '');
    const typingText = getTypingText(item.typing, user?.uid);
    const mediaPreview = getMediaPreview(item.lastMessage, item.lastMessageType);
    const isMe = item.lastMessageSender === user?.uid;
    const peerName = !item.isGroup && !isMe ? '' : (userNames[item.lastMessageSender || ''] || '');
    const readByPeer = isReadByPeer(item);

    const preview = typingText
      ? typingText
      : mediaPreview
        ? (item.isGroup && peerName ? `${peerName}: ${mediaPreview}` : mediaPreview)
        : (item.isGroup && peerName && item.lastMessage ? `${peerName}: ${item.lastMessage}` : item.lastMessage);

    return (
      <Swipeable renderRightActions={() => renderRightActions(item)} overshootRight={false}>
        <Pressable
          style={({ pressed }) => [styles.chatItem, pressed && { backgroundColor: colors.glassHighlight }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            navigation.navigate('Chat', { chatId: item.id, name: getChatName(item), isGroup: item.isGroup });
          }}
          onLongPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            Alert.alert(getChatName(item), '', [
              { text: 'Cancelar', style: 'cancel' },
              { text: isPinned ? 'Desafixar' : 'Fixar no topo', onPress: () => handleTogglePin(item) },
              { text: isMuted ? 'Ativar notificações' : 'Silenciar', onPress: () => handleToggleMute(item) },
              { text: 'Marcar como lido', onPress: () => handleMarkAsRead(item) },
            ]);
          }}
        >
          <View style={styles.avatarWrap}>
            <AvatarImage photoURL={getChatPhoto(item)} name={getChatName(item)} size={48} />
            {isOnline && <View style={styles.onlineDot} />}
          </View>
          <View style={styles.chatInfo}>
            <View style={styles.chatNameRow}>
              <Text style={[styles.chatName, unread > 0 && { fontWeight: '800' }]} numberOfLines={1}>
                {getChatName(item)}
              </Text>
              {isPinned && <Ionicons name="pin" size={12} color={colors.accent} style={{ marginLeft: 4 }} />}
              {isMuted && <Ionicons name="volume-mute" size={14} color={colors.textMuted} style={{ marginLeft: 4 }} />}
            </View>
            <View style={styles.previewRow}>
              {typingText ? (
                <Text style={[styles.lastMessage, { color: colors.accent, fontStyle: 'italic' }]} numberOfLines={1}>
                  {typingText}
                </Text>
              ) : (
                <Text
                  style={[styles.lastMessage, unread > 0 && { color: colors.text, fontWeight: '600' }]}
                  numberOfLines={1}
                >
                  {preview}
                </Text>
              )}
            </View>
          </View>
          <View style={styles.chatMeta}>
            <Text style={[styles.timestamp, unread > 0 && { color: colors.accent }]}>
              {formatChatTime(item.lastMessageTime)}
            </Text>
            {unread > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{unread > 99 ? '99+' : unread}</Text>
              </View>
            )}
            {!unread && isMe && item.lastMessage && (
              <Ionicons
                name={readByPeer ? 'checkmark-done' : 'checkmark'}
                size={16}
                color={readByPeer ? colors.accent : colors.textMuted}
                style={{ marginTop: 2 }}
              />
            )}
          </View>
        </Pressable>
      </Swipeable>
    );
  };

  return (
    <View style={styles.container}>
      {loading && !refreshing ? (
        <>
          <SkeletonChat />
          <SkeletonChat />
          <SkeletonChat />
          <SkeletonChat />
          <SkeletonChat />
        </>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.textMuted} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={onRefresh} style={styles.retryButton}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : chats.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="chatbubble-outline" size={36} color={colors.accent} />
          </View>
          <Text style={styles.emptyText}>Nenhuma conversa ainda</Text>
          <Text style={styles.emptySubtext}>
            Toque no botão + abaixo para iniciar uma conversa
          </Text>
        </View>
      ) : (
        <FlatList
          data={sortedChats}
          keyExtractor={(item) => item.id}
          renderItem={renderChat}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          contentContainerStyle={{ paddingBottom: 80 }}
        />
      )}
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.9 }], opacity: 0.8 }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          navigation.navigate('NewChat');
        }}
      >
        <Ionicons name="add" size={28} color={colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  chatItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.borderLight,
    alignItems: 'center',
  },
  avatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    position: 'relative',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  chatInfo: { flex: 1 },
  chatNameRow: { flexDirection: 'row', alignItems: 'center' },
  chatName: { color: colors.text, fontSize: 16, fontWeight: '600', flex: 1 },
  previewRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  lastMessage: { color: colors.textMuted, fontSize: 14, flex: 1 },
  chatMeta: { alignItems: 'flex-end', marginLeft: 8, gap: 4 },
  timestamp: { color: colors.textMuted, fontSize: 12 },
  unreadBadge: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  swipeActions: { flexDirection: 'row' },
  swipeAction: {
    width: 72,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  swipeActionText: { color: colors.white, fontSize: 11, fontWeight: '600' },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accent + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyText: { color: colors.text, fontSize: 18, fontWeight: '600' },
  emptySubtext: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accentDark,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  errorText: { color: colors.destructive, fontSize: 15, marginTop: 12 },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.elevated,
    borderRadius: 8,
  },
  retryText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  skeletonCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.elevated,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.elevated,
  },
});
