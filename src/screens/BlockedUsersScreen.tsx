import { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, FlatList, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { getColors } from '../theme/colors';
import { useSettingsStore } from '../store/settingsStore';
import EmptyState from '../components/EmptyState';

export default function BlockedUsersScreen() {
  const { user } = useAuth();
  const theme = useSettingsStore((s) => s.theme);
  const c = getColors(theme);
  const styles = useMemo(() => getStyles(c), [c]);
  const [blockedUids, setBlockedUids] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { displayName: string; photoURL?: string }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    return observeBlockedUids(user.uid, (uids) => {
      setBlockedUids(uids);
      if (uids.length === 0) {
        setLoading(false);
        setProfiles({});
        return;
      }
      const unsubs: (() => void)[] = [];
      uids.forEach((uid) => {
        const unsub = db.collection('users').doc(uid).onSnapshot((doc) => {
          if (doc.exists) {
            const d = doc.data()!;
            setProfiles((prev) => ({ ...prev, [uid]: { displayName: d.displayName || 'Usuário', photoURL: d.photoURL } }));
          }
        });
        unsubs.push(unsub);
      });
      setLoading(false);
      return () => unsubs.forEach((u) => u());
    });
  }, [user]);

  const handleUnblock = (targetUid: string, name: string) => {
    Alert.alert('Desbloquear', `Deseja desbloquear ${name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Desbloquear', onPress: () => { if (user) unblockUser(user.uid, targetUid); } },
    ]);
  };

  return (
    <View style={styles.container}>
      {blockedUids.length === 0 ? (
        <EmptyState icon="shield-outline" title="Nenhum usuário bloqueado" subtitle="Toque em Bloquear no perfil ou no menu do chat para bloquear alguém." />
      ) : (
        <FlatList
          data={blockedUids}
          keyExtractor={(item) => item}
          contentContainerStyle={{ paddingVertical: 8 }}
          renderItem={({ item: uid }) => {
            const profile = profiles[uid];
            const name = profile?.displayName || 'Carregando...';
            return (
              <TouchableOpacity style={styles.item} onPress={() => handleUnblock(uid, name)} activeOpacity={0.7}>
                <View style={styles.avatar}>
                  {profile?.photoURL ? (
                    <Image source={profile.photoURL} style={styles.avatarImage} contentFit="cover" transition={200} />
                  ) : (
                    <Text style={styles.avatarText}>{(name[0] || 'U').toUpperCase()}</Text>
                  )}
                </View>
                <Text style={styles.name} numberOfLines={1}>{name}</Text>
                <Ionicons name="lock-open-outline" size={20} color={c.textMuted} />
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

function getStyles(c: ReturnType<typeof getColors>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.bg,
    },
    empty: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    emptyText: {
      color: c.textMuted,
      fontSize: 18,
      fontWeight: '600',
      marginTop: 16,
    },
    emptySubtext: {
      color: c.textSubtle,
      fontSize: 14,
      textAlign: 'center',
      marginTop: 8,
      lineHeight: 20,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      gap: 12,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: c.accentDark,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    avatarImage: {
      width: 48,
      height: 48,
      borderRadius: 24,
    },
    avatarText: {
      color: c.text,
      fontSize: 20,
      fontWeight: 'bold',
    },
    name: {
      flex: 1,
      color: c.text,
      fontSize: 16,
    },
  });
}
