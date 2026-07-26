import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useMediaPicker } from '../hooks/useMediaPicker';
import { db } from '../services/firebase';
import { uploadEncryptedPostMedia, uploadPostMedia, uploadPostMedias, uploadEncryptedPostMedias } from '../services/storage';
import { compressVideo } from '../services/videoCompressor';
import { getColors } from '../theme/colors';
import { useSettingsStore } from '../store/settingsStore';
import { useToast } from '../components/Toast';
import { sendFcmPush } from '../services/notifications';

export default function CreatePostScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const { showToast } = useToast();
  const [text, setText] = useState('');
  const [selectedMedias, setSelectedMedias] = useState<{ uri: string; type: 'image' | 'video' }[]>([]);
  const [publishing, setPublishing] = useState(false);
  const { pickMultipleFromGallery, loading: mediaLoading } = useMediaPicker();
  const theme = useSettingsStore((s) => s.theme);
  const c = getColors(theme);
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => getStyles(c), [c]);

  const handleAddMedia = async () => {
    const medias = await pickMultipleFromGallery();
    if (medias.length > 0) setSelectedMedias(medias);
  };

  const handlePublish = async () => {
    if ((!text.trim() && selectedMedias.length === 0) || !user) return;
    setPublishing(true);
    try {
      const userDoc = await db.collection('users').doc(user.uid).get();
      const senderPhoto = userDoc.data()?.photoURL || null;
      const docRef = await db.collection('posts').add({
        text: text.trim() || '',
        senderId: user.uid,
        senderName: user.displayName || 'Anônimo',
        senderPhoto,
        mediaType: selectedMedias.length > 0 ? (selectedMedias[0].type || null) : null,
        timestamp: new Date(),
        likesCount: 0,
        commentsCount: 0,
      });

      if (selectedMedias.length > 0) {
        showToast('Enviando mídia para o feed...', 'info');
        const uris = await Promise.all(selectedMedias.map((m) => m.type === 'video' ? compressVideo(m.uri) : Promise.resolve(m.uri)));
        const encrypted = await uploadEncryptedPostMedias(docRef.id, uris);
        if (encrypted.mediaUrls.length > 0) {
          await db.collection('posts').doc(docRef.id).update({
            mediaUrls: encrypted.mediaUrls,
            mediaKeys: encrypted.mediaKeys,
            mediaIvs: encrypted.mediaIvs,
          });
          showToast('Mídia publicada!', 'success');
        } else {
          const urls = await uploadPostMedias(docRef.id, uris);
          if (urls.length > 0) {
            await db.collection('posts').doc(docRef.id).update({ mediaUrls: urls });
            showToast('Mídia publicada!', 'success');
          } else {
            await db.collection('posts').doc(docRef.id).delete();
            showToast('Erro ao enviar mídia', 'error');
            setPublishing(false);
            return;
          }
        }
      }

      // Notify chat contacts about new post
      try {
        const chatsSnap = await db.collection('chats')
          .where('participants', 'array-contains', user.uid)
          .get();
        const notified = new Set<string>();
        chatsSnap.forEach((doc) => {
          (doc.data().participants || []).forEach((p: string) => {
            if (p !== user.uid) notified.add(p);
          });
        });
        const senderName = user.displayName || 'Alguém';
        for (const uid of notified) {
          sendFcmPush(uid, 'Novo post', `${senderName} publicou no feed`, { type: 'post', senderId: user.uid, senderName }, 'posts', user.photoURL || undefined, 'post').catch(() => {});
        }
      } catch {}

      navigation.goBack();
    } catch (error) {
      showToast('Não foi possível publicar', 'error');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 44 : 0}>
      <View style={styles.content}>
        <TextInput
          style={styles.input}
          placeholder="O que você está pensando?"
          placeholderTextColor={c.textMuted}
          value={text}
          onChangeText={setText}
          multiline
        />

        {selectedMedias.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 80 }}>
            {selectedMedias.map((m, i) => (
              <View key={i} style={[styles.mediaPreview, { marginRight: 8 }]}>
                {m.type === 'video' ? (
                  <View style={styles.videoThumb}>
                    <Ionicons name="videocam" size={20} color={c.accent} />
                  </View>
                ) : (
                  <Image source={m.uri} style={styles.thumbnail} contentFit="cover" transition={200} />
                )}
                <TouchableOpacity onPress={() => setSelectedMedias((prev) => prev.filter((_, j) => j !== i))} style={{ position: 'absolute', top: -4, right: -4, backgroundColor: c.destructive, borderRadius: 10, width: 18, height: 18, justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="close" size={12} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        <TouchableOpacity style={styles.mediaButton} onPress={handleAddMedia} disabled={mediaLoading}>
          <Ionicons name="image-outline" size={20} color={c.accent} style={{ marginRight: 8 }} />
          <Text style={styles.mediaButtonText}>Adicionar mídia</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.publishButton, publishing && styles.disabled]}
          onPress={handlePublish}
          disabled={publishing || (!text.trim() && selectedMedias.length === 0)}
        >
          {publishing ? (
            <ActivityIndicator color={c.bg} />
          ) : (
            <Text style={styles.publishText}>Publicar</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function getStyles(c: ReturnType<typeof getColors>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.bg,
    },
    content: {
      padding: 16,
      gap: 16,
    },
    input: {
      backgroundColor: c.elevated,
      color: c.text,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      minHeight: 120,
      textAlignVertical: 'top',
    },
    mediaPreview: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    thumbnail: {
      width: 60,
      height: 60,
      borderRadius: 8,
    },
    videoThumb: {
      width: 60,
      height: 60,
      borderRadius: 8,
      backgroundColor: c.elevated,
      justifyContent: 'center',
      alignItems: 'center',
    },
    videoLabel: {
      color: c.textMuted,
      fontSize: 10,
      marginTop: 2,
    },
    removeMedia: {
      color: c.destructive,
      fontSize: 14,
      fontWeight: '600',
    },
    mediaButton: {
      backgroundColor: c.elevated,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    mediaButtonText: {
      color: c.text,
      fontSize: 16,
    },
    publishButton: {
      backgroundColor: c.accent,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    disabled: {
      opacity: 0.5,
    },
    publishText: {
      color: c.bg,
      fontSize: 16,
      fontWeight: 'bold',
    },
  });
}
