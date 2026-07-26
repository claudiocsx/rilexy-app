import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Animated,
  RefreshControl,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AvatarImage from '../components/AvatarImage';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';

type ChatNav = NativeStackNavigationProp<RootStackParamList>;

interface Chat {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastMessageTime?: string;
  name?: string;
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
        const chunks: string[][] = [];
        for (let i = 0; i < uniqueIds.length; i += 10) {
          chunks.push(uniqueIds.slice(i, i + 10));
        }
        const photoMap: Record<string, string> = {};
        for (const chunk of chunks) {
          const snap = await db
            .collection('users')
            .where('uid', 'in', chunk)
            .get();
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
    if (chat.name) return null;
    const otherId = chat.participants.find((id) => id !== user?.uid);
    return userPhotos[otherId || ''] || null;
  };

  const getOtherUid = (chat: Chat): string | null => {
    if (chat.name) return null;
    return chat.participants.find((id) => id !== user?.uid) || null;
  };

  const renderChat = ({ item }: { item: Chat }) => {
    const otherUid = getOtherUid(item);
    const isOnline = otherUid ? onlineUsers.has(otherUid) : false;
    return (
      <Pressable
        style={({ pressed }) => [styles.chatItem, pressed && { backgroundColor: colors.glassHighlight }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          navigation.navigate('Chat', { chatId: item.id, name: getChatName(item) });
        }}
      >
        <View style={styles.avatarWrap}>
          <AvatarImage photoURL={getChatPhoto(item)} name={getChatName(item)} size={48} />
          {isOnline && <View style={styles.onlineDot} />}
        </View>
        <View style={styles.chatInfo}>
          <Text style={styles.chatName}>{getChatName(item)}</Text>
          {item.lastMessage && (
            <Text style={styles.lastMessage} numberOfLines={1}>
              {item.lastMessage}
            </Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </Pressable>
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
          data={chats}
          keyExtractor={(item) => item.id}
          renderItem={renderChat}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
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
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
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
  chatInfo: {
    flex: 1,
  },
  chatName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  lastMessage: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 2,
  },
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
  emptyText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtext: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    color: colors.destructive,
    fontSize: 15,
    marginTop: 12,
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.elevated,
    borderRadius: 8,
  },
  retryText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
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
