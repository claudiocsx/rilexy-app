import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useAuth } from '../contexts/AuthContext';
import { logoutUser } from '../services/auth';
import { db } from '../services/firebase';
import { uploadAvatar } from '../services/storage';
import { useMediaPicker } from '../hooks/useMediaPicker';
import { colors } from '../theme/colors';

export default function ProfileScreen() {
  const { user } = useAuth();
  const { pickFromGallery, takePhoto } = useMediaPicker();
  const [photoURL, setPhotoURL] = useState<string | null>(user?.photoURL || null);
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState({ followers: 0, following: 0, posts: 0 });

  useEffect(() => {
    if (!user) return;
    const unsubPosts = db.collection('posts')
      .where('senderId', '==', user.uid)
      .onSnapshot((snap) => {
        setStats((prev) => ({ ...prev, posts: snap.size }));
      });
    const unsubFollowers = db.collection('users').doc(user.uid)
      .onSnapshot((doc) => {
        if (doc.exists) {
          const data = doc.data() || {};
          setPhotoURL(data.photoURL || null);
          setStats((prev) => ({
            ...prev,
            followers: data.followersCount || 0,
            following: data.followingCount || 0,
          }));
        }
      });
    return () => { unsubPosts(); unsubFollowers(); };
  }, [user]);

  const handleChangeAvatar = () => {
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
        setPhotoURL(url);
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível atualizar a foto');
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sair', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: logoutUser },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.profileCard}>
        <TouchableOpacity onPress={handleChangeAvatar} activeOpacity={0.8}>
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
                <ActivityIndicator color={colors.white} />
              </View>
            )}
            <View style={styles.avatarBadge}>
              <Text style={styles.avatarBadgeText}>📷</Text>
            </View>
          </View>
        </TouchableOpacity>
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

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Sair</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 16,
  },
  profileCard: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accentDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: colors.accent,
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
    backgroundColor: colors.accent,
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  avatarBadgeText: {
    fontSize: 12,
  },
  avatarText: {
    color: colors.text,
    fontSize: 36,
    fontWeight: 'bold',
  },
  name: {
    color: colors.text,
    fontSize: 22,
    fontWeight: 'bold',
  },
  email: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 24,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 24,
  },
  stat: {
    alignItems: 'center',
  },
  statNumber: {
    color: colors.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  logoutButton: {
    backgroundColor: colors.elevated,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  logoutText: {
    color: colors.destructive,
    fontSize: 16,
    fontWeight: '600',
  },
});
