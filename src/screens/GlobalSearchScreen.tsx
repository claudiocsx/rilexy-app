import { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { db } from '../services/firebase';
import { getColors } from '../theme/colors';
import { useSettingsStore } from '../store/settingsStore';
import EmptyState from '../components/EmptyState';

interface SearchResult {
  chatId: string;
  chatName: string;
  messageId: string;
  text: string;
  timestamp: any;
  senderId: string;
  senderName: string;
}

export default function GlobalSearchScreen() {
  const theme = useSettingsStore((s) => s.theme);
  const c = getColors(theme);
  const styles = useMemo(() => getStyles(c), [c]);
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const doSearch = useCallback(async (q: string) => {
    if (!user || !q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const chatSnap = await db.collection('chats')
        .where('participants', 'array-contains', user.uid)
        .get();
      const chatIds = chatSnap.docs.map((d) => ({ id: d.id, name: d.data().name || '' }));

      const promises = chatIds.map(async (chat) => {
        const msgSnap = await db.collection('chats').doc(chat.id).collection('messages')
          .where('text', '>=', q.trim())
          .where('text', '<=', q.trim() + '\uf8ff')
          .orderBy('text')
          .limit(5)
          .get();
        return msgSnap.docs.map((d) => {
          const data = d.data();
          return {
            chatId: chat.id,
            chatName: chat.name || data.senderName || 'Conversa',
            messageId: d.id,
            text: data.text || '',
            timestamp: data.timestamp,
            senderId: data.senderId || '',
            senderName: data.senderName || '',
          };
        });
      });

      const allResults = (await Promise.all(promises)).flat();
      const unique = new Map<string, SearchResult>();
      allResults.forEach((r) => {
        const key = `${r.chatId}_${r.messageId}`;
        if (!unique.has(key)) unique.set(key, r);
      });
      setResults(Array.from(unique.values()));
    } catch {
      setResults([]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    const timer = setTimeout(() => doSearch(query), 400);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  const renderItem = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity
      style={styles.resultRow}
      activeOpacity={0.7}
      onPress={() => {
        navigation.navigate('Chat', { chatId: item.chatId, name: item.chatName, initialText: '' });
      }}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.chatName[0]?.toUpperCase() || '?'}</Text>
      </View>
      <View style={styles.resultInfo}>
        <View style={styles.resultHeader}>
          <Text style={styles.chatName} numberOfLines={1}>{item.chatName}</Text>
          <Text style={styles.senderName}>{item.senderName}</Text>
        </View>
        <Text style={styles.messageText} numberOfLines={2}>{item.text}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={c.textMuted} />
        <TextInput
          style={styles.input}
          placeholder="Pesquisar em todas as conversas..."
          placeholderTextColor={c.textMuted}
          value={query}
          onChangeText={setQuery}
          autoFocus
          returnKeyType="search"
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color={c.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>
      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={c.accent} />
        </View>
      )}
      {!loading && results.length === 0 && query.trim().length >= 2 && (
        <EmptyState icon="search-outline" title="Nenhum resultado encontrado" subtitle="Tente buscar por palavras diferentes" />
      )}
      <FlatList
        data={results}
        keyExtractor={(item) => `${item.chatId}_${item.messageId}`}
        renderItem={renderItem}
        contentContainerStyle={{ paddingVertical: 8 }}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

function getStyles(c: ReturnType<typeof getColors>) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingTop: 40,
  },
  emptyText: {
    color: c.textMuted,
    fontSize: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.elevated,
    borderRadius: 10,
    margin: 12,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  input: {
    flex: 1,
    color: c.text,
    fontSize: 15,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.accentDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: c.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  resultInfo: {
    flex: 1,
  },
  resultHeader: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 2,
  },
  chatName: {
    color: c.text,
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  senderName: {
    color: c.textMuted,
    fontSize: 13,
  },
  messageText: {
    color: c.textMuted,
    fontSize: 14,
  },
  });
}
