import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  RefreshControl,
} from 'react-native';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';

type GroupNav = NativeStackNavigationProp<RootStackParamList>;

interface Group {
  id: string;
  name: string;
  participants: string[];
  createdBy: string;
}

export default function GroupsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<GroupNav>();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  useEffect(() => {
    if (!user) return;
    return db.collection('groups')
      .where('participants', 'array-contains', user.uid)
      .onSnapshot((snapshot) => {
      const groupsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Group[];
      setGroups(groupsData);
      setLoading(false);
      setError(null);
    }, (err) => {
      setLoading(false);
      setError('Erro ao carregar grupos');
      console.error('Groups onSnapshot error:', err);
    });
  }, [user]);

  const handleCreateGroup = async () => {
    const name = newGroupName.trim();
    if (!name || !user) return;
    setCreating(true);
    try {
      const docRef = await db.collection('groups').add({
        name,
        participants: [user.uid],
        createdBy: user.uid,
        createdAt: new Date(),
      });
      setShowCreateModal(false);
      setNewGroupName('');
      navigation.navigate('Chat', { chatId: docRef.id, name });
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível criar o grupo');
    } finally {
      setCreating(false);
    }
  };

  const renderGroup = ({ item }: { item: Group }) => (
    <TouchableOpacity
      style={styles.groupItem}
      onPress={() =>
        navigation.navigate('Chat', { chatId: item.id, name: item.name })
      }
    >
      <View style={styles.groupAvatar}>
        <Text style={styles.avatarText}>
          {(item.name || 'G')[0].toUpperCase()}
        </Text>
      </View>
      <View style={styles.groupInfo}>
        <Text style={styles.groupName}>{item.name}</Text>
        <Text style={styles.memberCount}>
          {item.participants.length} participantes
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.createButton} onPress={() => setShowCreateModal(true)}>
        <Text style={styles.createButtonText}>+ Criar Grupo</Text>
      </TouchableOpacity>
      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Nenhum grupo ainda</Text>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.id}
          renderItem={renderGroup}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        />
      )}

      <Modal visible={showCreateModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Novo Grupo</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Nome do grupo"
              placeholderTextColor={colors.textMuted}
              value={newGroupName}
              onChangeText={setNewGroupName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => { setShowCreateModal(false); setNewGroupName(''); }}>
                <Text style={styles.modalCancel}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCreateGroup} disabled={creating || !newGroupName.trim()}>
                {creating ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <Text style={styles.modalCreate}>Criar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  createButton: {
    backgroundColor: colors.accentDark,
    margin: 12,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  createButtonText: {
    color: colors.text,
    fontWeight: 'bold',
    fontSize: 16,
  },
  groupItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.borderLight,
    alignItems: 'center',
  },
  groupAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accentDeep,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  memberCount: {
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: colors.destructive,
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    width: '85%',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: colors.elevated,
    color: colors.text,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
  },
  modalCancel: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '600',
    padding: 8,
  },
  modalCreate: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: 'bold',
    padding: 8,
  },
});
