import { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { findOrCreateChat } from '../services/chat';
import { blockUser, unblockUser, observeBlockedUids } from '../services/block';
import { getColors } from '../theme/colors';
import { useSettingsStore } from '../store/settingsStore';
import { useToast } from '../components/Toast';
import MediaViewer from '../components/MediaViewer';
import { decryptAndCache } from '../services/crypto';

interface UserPost {
  id: string;
  mediaUrl?: string;
  mediaUrls?: string[];
  mediaKeys?: string[];
  mediaIvs?: string[];
  mediaType?: string;
  timestamp?: any;
}

type UserProfileRoute = RouteProp<RootStackParamList, 'UserProfile'>;

export default function UserProfileScreen() {
  const theme = useSettingsStore((s) => s.theme);
  const c = getColors(theme);
  const styles = useMemo(() => getStyles(c), [c]);
  const route = useRoute<UserProfileRoute>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { userId } = route.params;
  const { showToast } = useToast();
  const [profile, setProfile] = useState<{ displayName: string; photoURL?: string; bio?: string } | null>(null);
  const [stats, setStats] = useState({ followers: 0, following: 0, posts: 0 });
  const [loading, setLoading] = useState(true);
  const [blockedUids, setBlockedUids] = useState<string[]>([]);
  const [userPosts, setUserPosts] = useState<UserPost[]>([]);
  const [decryptedUris, setDecryptedUris] = useState<Record<string, string>>({});
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const POST_THUMB_SIZE = (Dimensions.get('window').width - 32 - 8) / 3;

  useEffect(() => {
    const unsub = db.collection('posts')
      .where('senderId', '==', userId)
      .onSnapshot((snap) => {
        setStats((prev) => ({ ...prev, posts: snap.size }));
        const postsData = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as UserPost[];
        postsData.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
        setUserPosts(postsData);
      }, (err) => console.error('Profile posts error:', err));

    const unsubUser = db.collection('users').doc(userId).onSnapshot((doc) => {
      if (doc.exists) {
        const data = doc.data()!;
        setProfile({ displayName: data.displayName || 'Usuário', photoURL: data.photoURL, bio: data.bio });
        setStats({ followers: data.followersCount || 0, following: data.followingCount || 0, posts: 0 });
      }
      setLoading(false);
    });
    return () => { unsub(); unsubUser(); };
  }, [userId]);

  useEffect(() => {
    if (!user) return;
    return observeBlockedUids(user.uid, setBlockedUids);
  }, [user]);

  useEffect(() => {
    const map: Record<string, string> = {};
    Promise.all(userPosts.map(async (p) => {
      const url = p.mediaUrls?.[0] || p.mediaUrl;
      if (!url) return;
      try {
        const mime = p.mediaType?.startsWith('video') ? 'video/mp4' : 'image/jpeg';
        const uri = await decryptAndCache(url, p.mediaKeys?.[0], p.mediaIvs?.[0], mime);
        if (uri) map[p.id] = uri;
      } catch { map[p.id] = url; }
    })).then(() => setDecryptedUris(map));
  }, [userPosts]);

  const handleChat = async () => {
    if (!user) return;
    try {
      const chatId = await findOrCreateChat(user.uid, userId, profile?.displayName);
      navigation.navigate('Chat', { chatId, name: profile?.displayName || 'Usuário' });
    } catch {
      showToast('Não foi possível iniciar conversa', 'error');
    }
  };

  const isOwnProfile = user?.uid === userId;

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          {profile?.photoURL ? (
            <Image source={profile.photoURL} style={styles.avatarImage} contentFit="cover" transition={200} />
          ) : (
            <Text style={styles.avatarText}>
              {(profile?.displayName || 'U')[0].toUpperCase()}
            </Text>
          )}
        </View>
        <Text style={styles.name}>{profile?.displayName || 'Usuário'}</Text>
        {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{stats.followers}</Text>
          <Text style={styles.statLabel}>Seguidores</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{stats.following}</Text>
          <Text style={styles.statLabel}>Seguindo</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{stats.posts}</Text>
          <Text style={styles.statLabel}>Posts</Text>
        </View>
      </View>

      {!isOwnProfile && (
        <TouchableOpacity style={styles.chatButton} onPress={handleChat}>
          <Ionicons name="chatbubble-outline" size={20} color={c.bg} />
          <Text style={styles.chatButtonText}>Conversar</Text>
        </TouchableOpacity>
      )}
      {!isOwnProfile && (
        <View style={styles.callRow}>
          <TouchableOpacity
            style={[styles.callButton, { backgroundColor: c.accentDark }]}
            onPress={() => navigation.navigate('Call', { peerId: userId, peerName: profile?.displayName || 'Usuário', audioOnly: true, isIncoming: false })}
          >
            <Ionicons name="call-outline" size={20} color={c.text} />
            <Text style={[styles.chatButtonText, { color: c.text, fontSize: 14 }]}>Áudio</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.callButton, { backgroundColor: c.accentDark }]}
            onPress={() => navigation.navigate('Call', { peerId: userId, peerName: profile?.displayName || 'Usuário', audioOnly: false, isIncoming: false })}
          >
            <Ionicons name="videocam-outline" size={20} color={c.text} />
            <Text style={[styles.chatButtonText, { color: c.text, fontSize: 14 }]}>Vídeo</Text>
          </TouchableOpacity>
        </View>
      )}
      {!isOwnProfile && (
        <TouchableOpacity
          style={[styles.chatButton, { backgroundColor: blockedUids.includes(userId) ? c.surface : c.destructive, marginTop: 8, borderWidth: 1, borderColor: blockedUids.includes(userId) ? c.borderLight : 'transparent' }]}
          onPress={() => {
            if (blockedUids.includes(userId)) {
              Alert.alert('Desbloquear', `Deseja desbloquear ${profile?.displayName || 'este usuário'}?`, [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Desbloquear', onPress: () => unblockUser(user!.uid, userId) },
              ]);
            } else {
              Alert.alert('Bloquear', `${profile?.displayName || 'Este usuário'} não poderá mais enviar mensagens ou chamar você.`, [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Bloquear', style: 'destructive', onPress: () => blockUser(user!.uid, userId) },
              ]);
            }
          }}
        >
          <Ionicons name={blockedUids.includes(userId) ? 'lock-open-outline' : 'lock-closed-outline'} size={20} color={blockedUids.includes(userId) ? c.text : c.white} />
          <Text style={[styles.chatButtonText, { color: blockedUids.includes(userId) ? c.text : c.white }]}>
            {blockedUids.includes(userId) ? 'Desbloquear' : 'Bloquear'}
          </Text>
        </TouchableOpacity>
      )}

      {userPosts.length > 0 && (
        <View style={{ marginTop: 24 }}>
          <Text style={[styles.statLabel, { fontSize: 16, fontWeight: '700', marginBottom: 8 }]}>Posts</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {userPosts.map((p) => {
              const uri = decryptedUris[p.id] || p.mediaUrls?.[0] || p.mediaUrl;
              if (!uri) return null;
              return (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => setSelectedMedia(uri)}
                  style={{ width: POST_THUMB_SIZE, height: POST_THUMB_SIZE, margin: 2 }}
                >
                  <Image source={{ uri }} style={{ flex: 1 }} contentFit="cover" transition={200} />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      <MediaViewer visible={!!selectedMedia} uri={selectedMedia} onClose={() => setSelectedMedia(null)} />
    </ScrollView>
  );
}

function getStyles(c: ReturnType<typeof getColors>) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg,
    padding: 16,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileCard: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: c.accentDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: c.accent,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarText: {
    color: c.text,
    fontSize: 40,
    fontWeight: 'bold',
  },
  name: {
    color: c.text,
    fontSize: 22,
    fontWeight: 'bold',
  },
  bio: {
    color: c.textMuted,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 24,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: c.borderLight,
    marginBottom: 24,
  },
  stat: {
    alignItems: 'center',
  },
  statNumber: {
    color: c.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    color: c.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: c.accent,
    borderRadius: 12,
    paddingVertical: 14,
  },
  chatButtonText: {
    color: c.bg,
    fontSize: 16,
    fontWeight: 'bold',
  },
  callRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  callButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
  },
  });
}
