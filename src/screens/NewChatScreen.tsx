import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { searchUsers, UserProfile } from '../services/user';
import { findOrCreateChat } from '../services/chat';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';

type NewChatNav = NativeStackNavigationProp<RootStackParamList>;

export default function NewChatScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NewChatNav>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearch = useCallback(async (text: string) => {
    setQuery(text);
    setSearchError(null);
    if (text.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const users = await searchUsers(text);
      setResults(users.filter((u) => u.uid !== user?.uid));
      if (users.filter((u) => u.uid !== user?.uid).length === 0) {
        setSearchError('Nenhum usuário encontrado');
      }
    } catch {
      setResults([]);
      setSearchError('Erro ao buscar. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const handleSelectUser = async (otherUser: UserProfile) => {
    if (!user) return;
    try {
      const chatId = await findOrCreateChat(
        user.uid,
        otherUser.uid,
        otherUser.displayName || undefined
      );
      navigation.replace('Chat', {
        chatId,
        name: otherUser.displayName || otherUser.email || 'Usuário',
      });
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Não foi possível iniciar a conversa');
    }
  };

  const renderUser = ({ item }: { item: UserProfile }) => (
    <TouchableOpacity style={styles.userItem} onPress={() => handleSelectUser(item)}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {(item.displayName || '?')[0].toUpperCase()}
        </Text>
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.displayName || 'Sem nome'}</Text>
        <Text style={styles.userEmail}>{item.email}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Buscar por nome..."
        placeholderTextColor={colors.textMuted}
        value={query}
        onChangeText={handleSearch}
        autoFocus
      />
      {loading ? (
        <ActivityIndicator color={colors.accent} style={styles.loading} />
      ) : searchError ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{searchError}</Text>
        </View>
      ) : results.length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={(item) => item.uid}
          renderItem={renderUser}
        />
      ) : query.trim().length < 2 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Digite pelo menos 2 caracteres</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  searchInput: {
    backgroundColor: colors.elevated,
    color: colors.text,
    margin: 12,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  loading: {
    marginTop: 24,
  },
  userItem: {
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
  },
  avatarText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  userEmail: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 2,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 16,
  },
});
