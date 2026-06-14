import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

export default function ChatsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<ChatNav>();
  const [chats, setChats] = useState<Chat[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [userPhotos, setUserPhotos] = useState<Record<string, string>>({});
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

  const renderChat = ({ item }: { item: Chat }) => (
    <TouchableOpacity
      style={styles.chatItem}
      onPress={() =>
        navigation.navigate('Chat', { chatId: item.id, name: getChatName(item) })
      }
    >
      <View style={styles.avatar}>
        <AvatarImage photoURL={getChatPhoto(item)} name={getChatName(item)} size={48} />
      </View>
      <View style={styles.chatInfo}>
        <Text style={styles.chatName}>{getChatName(item)}</Text>
        {item.lastMessage && (
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.lastMessage}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => onRefresh()}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : chats.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="chatbubble-outline" size={48} color={colors.textMuted} />
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
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('NewChat')}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
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
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accentDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  avatarText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: 'bold',
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
  fabText: {
    color: colors.text,
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: -2,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: colors.destructive,
    fontSize: 15,
    marginBottom: 8,
  },
  retryText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
});
