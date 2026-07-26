import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator, ScrollView, Dimensions, Animated } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../contexts/AuthContext';
import { logoutUser } from '../services/auth';
import { auth, db } from '../services/firebase';
import { uploadAvatar } from '../services/storage';
import { useMediaPicker } from '../hooks/useMediaPicker';
import { getColors } from '../theme/colors';
import { useSettingsStore } from '../store/settingsStore';
import { INTENTIONS } from '../constants/intentions';
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

export default function ProfileScreen() {
  const theme = useSettingsStore((s) => s.theme);
  const c = getColors(theme);
  const styles = useMemo(() => getStyles(c), [c]);
  const { user } = useAuth();
  const { pickFromGallery, takePhoto } = useMediaPicker();
  const [photoURL, setPhotoURL] = useState<string | null>(user?.photoURL || null);
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState({ followers: 0, following: 0, posts: 0 });
  const [intention, setIntention] = useState<string | null>(null);
  const { showToast } = useToast();
  const [userPosts, setUserPosts] = useState<UserPost[]>([]);
  const [decryptedUris, setDecryptedUris] = useState<Record<string, string>>({});
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const POST_THUMB_SIZE = (Dimensions.get('window').width - 32 - 8) / 3;
  const animatedFollowers = useRef(new Animated.Value(0)).current;
  const animatedFollowing = useRef(new Animated.Value(0)).current;
  const animatedPosts = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(animatedFollowers, { toValue: stats.followers, tension: 50, friction: 8, useNativeDriver: false }),
      Animated.spring(animatedFollowing, { toValue: stats.following, tension: 50, friction: 8, useNativeDriver: false }),
      Animated.spring(animatedPosts, { toValue: stats.posts, tension: 50, friction: 8, useNativeDriver: false }),
    ]).start();
  }, [stats.followers, stats.following, stats.posts]);

  useEffect(() => {
    if (!user) return;
    const unsubPosts = db.collection('posts')
      .where('senderId', '==', user.uid)
      .onSnapshot((snap) => {
        setStats((prev) => ({ ...prev, posts: snap.size }));
        const postsData = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as UserPost[];
        postsData.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
        setUserPosts(postsData);
      }, (err) => console.error('Profile posts error:', err));
    const unsubFollowers = db.collection('users').doc(user.uid)
      .onSnapshot((doc) => {
        if (doc.exists) {
          const data = doc.data() || {};
          setPhotoURL(data.photoURL || null);
          setIntention(data.intention || null);
          setStats((prev) => ({
            ...prev,
            followers: data.followersCount || 0,
            following: data.followingCount || 0,
          }));
        }
      });
    return () => { unsubPosts(); unsubFollowers(); };
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
      } catch { /* falha silenciosa: não adiciona ao map */ }
    })).then(() => setDecryptedUris(map));
  }, [userPosts]);

  const handleChangeAvatar = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Alert.alert('Foto de perfil', '', [
      { text: 'Câmera', onPress: handleTakePhoto },
      { text: 'Galeria', onPress: handlePickGallery },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const handlePickGallery = async () => {
    const media = await pickFromGallery();
    if (media) uploadAndSet(media.uri);
  };

  const handleTakePhoto = async () => {
    const media = await takePhoto();
    if (media) uploadAndSet(media.uri);
  };

  const uploadAndSet = async (uri: string) => {
    if (!user) return;
    setUploading(true);
    try {
      const url = await uploadAvatar(user.uid, uri);
      if (url) {
        await db.collection('users').doc(user.uid).update({ photoURL: url });
        await auth.currentUser?.updateProfile({ photoURL: url });
        setPhotoURL(url);
      }
    } catch {
      showToast('Não foi possível atualizar a foto', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleIntentionSelect = async (type: string | null) => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const update: Record<string, any> = { intention: type };
    if (type) update.intentionUpdatedAt = new Date();
    await db.collection('users').doc(user.uid).update(update).catch(() => {});
  };

  const handleLogout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Alert.alert('Sair', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: logoutUser },
    ]);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.profileCard}>
        <Pressable accessibilityLabel="Alterar foto de perfil" onPress={handleChangeAvatar} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
          <View style={styles.avatar}>
            {photoURL ? (
              <Image source={photoURL} style={styles.avatarImage} contentFit="cover" transition={200} />
            ) : (
              <Text style={styles.avatarText}>
                {(user?.displayName || 'U')[0].toUpperCase()}
              </Text>
            )}
            {uploading && (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color={c.white} />
              </View>
            )}
            <View style={styles.avatarBadge}>
              <Ionicons name="camera" size={14} color={c.bg} />
            </View>
          </View>
        </Pressable>
        <Text style={styles.name}>{user?.displayName || 'Usuário'}</Text>
        <Text style={styles.email}>{user?.email}</Text>
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

      <View style={styles.intentionSection}>
        <Text style={styles.intentionTitle}>Intenção</Text>
        <View style={styles.intentionRow}>
          {(Object.entries(INTENTIONS) as [string, typeof INTENTIONS[keyof typeof INTENTIONS]][]).map(([key, val]) => {
            const selected = intention === key;
            return (
              <Pressable
                key={key}
                accessibilityLabel={"Selecionar momento " + val.label}
                style={({ pressed }) => [
                  styles.intentionCard,
                  { backgroundColor: val.color + '20', borderColor: selected ? val.color : 'transparent', opacity: pressed ? 0.7 : 1 },
                  selected && styles.intentionCardSelected,
                ]}
                onPress={() => handleIntentionSelect(selected ? null : key)}
              >
                <Text style={styles.intentionEmoji}>{val.emoji}</Text>
                <Text style={[styles.intentionLabel, selected && { color: val.color, fontWeight: '700' }]} numberOfLines={2}>
                  {val.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {userPosts.length > 0 && (
        <View style={styles.postsSection}>
          <Text style={styles.postsTitle}>Posts</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {userPosts.map((p) => {
              const uri = decryptedUris[p.id] || p.mediaUrls?.[0] || p.mediaUrl;
              if (!uri) return null;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setSelectedMedia(uri)}
                  style={{ width: POST_THUMB_SIZE, height: POST_THUMB_SIZE, margin: 2, opacity: 1 }}
                >
                  <Image source={{ uri }} style={{ flex: 1 }} contentFit="cover" transition={200} />
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <Pressable accessibilityLabel="Sair" style={({ pressed }) => [styles.logoutButton, pressed && { opacity: 0.7 }]} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={18} color={c.destructive} />
        <Text style={styles.logoutText}>Sair</Text>
      </Pressable>
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
  profileCard: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: c.glassBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.glassBorder,
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: c.accentDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: c.accent,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: c.accent,
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: c.bg,
  },
  avatarText: {
    color: c.text,
    fontSize: 36,
    fontWeight: 'bold',
  },
  name: {
    color: c.text,
    fontSize: 22,
    fontWeight: 'bold',
  },
  email: {
    color: c.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 24,
    backgroundColor: c.glassBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.glassBorder,
    marginBottom: 16,
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
  intentionSection: {
    backgroundColor: c.glassBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.glassBorder,
    padding: 16,
    marginBottom: 16,
  },
  intentionTitle: {
    color: c.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  intentionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  intentionCard: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  intentionCardSelected: {
    borderWidth: 2,
  },
  intentionEmoji: {
    fontSize: 26,
  },
  intentionLabel: {
    color: c.textMuted,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 14,
  },
  postsSection: {
    marginBottom: 16,
  },
  postsTitle: {
    color: c.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: c.glassBg,
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: c.destructive + '40',
  },
  logoutText: {
    color: c.destructive,
    fontSize: 16,
    fontWeight: '600',
  },
  });
}
