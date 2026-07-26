import { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AvatarImage from '../components/AvatarImage';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { observeMutedUids, unmuteUser } from '../services/mute';
import { colors } from '../theme/colors';

interface MutedUser {
  uid: string;
  displayName: string;
  photoURL?: string;
}

export default function MutedUsersScreen() {
  const { user } = useAuth();
  const [mutedUids, setMutedUids] = useState<string[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [userPhotos, setUserPhotos] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    return observeMutedUids(user.uid, setMutedUids);
  }, [user?.uid]);

  useEffect(() => {
    if (mutedUids.length === 0) return;
    const uniqueIds = mutedUids.filter((id) => !userNames[id]);
    if (uniqueIds.length === 0) return;

    const fetchNames = async () => {
      try {
        const chunks: string[][] = [];
        for (let i = 0; i < uniqueIds.length; i += 10) {
          chunks.push(uniqueIds.slice(i, i + 10));
        }
        for (const chunk of chunks) {
          const snap = await db.collection('users').where('uid', 'in', chunk).get();
          const nameMap: Record<string, string> = {};
          const photoMap: Record<string, string> = {};
          snap.docs.forEach((doc) => {
            const data = doc.data();
            nameMap[doc.id] = data.displayName || 'Usuário';
            if (data.photoURL) photoMap[doc.id] = data.photoURL;
          });
          setUserNames((prev) => ({ ...prev, ...nameMap }));
          setUserPhotos((prev) => ({ ...prev, ...photoMap }));
        }
      } catch { /* silence */ }
    };
    fetchNames();
  }, [mutedUids]);

  const handleUnmute = (uid: string, name: string) => {
    if (!user) return;
    Alert.alert('Desmutar ' + name + '?', 'Posts dessa pessoa voltarão a aparecer no feed.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desmutar',
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          await unmuteUser(user.uid, uid);
        },
      },
    ]);
  };

  const mutedUsers: MutedUser[] = mutedUids.map((uid) => ({
    uid,
    displayName: userNames[uid] || 'Usuário',
    photoURL: userPhotos[uid],
  }));

  return (
    <View style={styles.container}>
      {mutedUsers.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="volume-high-outline" size={36} color={colors.accent} />
          </View>
          <Text style={styles.emptyText}>Nenhum usuário silenciado</Text>
          <Text style={styles.emptySubtext}>
            Ao silenciar alguém, os posts dela não aparecerão no seu feed.
          </Text>
        </View>
      ) : (
        <FlatList
          data={mutedUsers}
          keyExtractor={(item) => item.uid}
          renderItem={({ item }) => (
            <View style={styles.userItem}>
              <AvatarImage photoURL={item.photoURL} name={item.displayName} size={40} />
              <Text style={styles.userName}>{item.displayName}</Text>
              <Pressable
                onPress={() => handleUnmute(item.uid, item.displayName)}
                style={({ pressed }) => [styles.unmuteBtn, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="volume-high-outline" size={16} color={colors.accent} />
                <Text style={styles.unmuteText}>Desmutar</Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
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
    fontSize: 17,
    fontWeight: '600',
  },
  emptySubtext: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.borderLight,
    gap: 12,
  },
  userName: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  unmuteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.elevated,
    borderRadius: 16,
  },
  unmuteText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
});
