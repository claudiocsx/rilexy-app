import { useState } from 'react';
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
} from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { useMediaPicker } from '../hooks/useMediaPicker';
import { db } from '../services/firebase';
import { uploadEncryptedPostMedia } from '../services/storage';
import { compressVideo } from '../services/videoCompressor';
import { colors } from '../theme/colors';
import { Ionicons } from '@expo/vector-icons';

export default function CreatePostScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [text, setText] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<{ uri: string; type: 'image' | 'video' } | null>(null);
  const [publishing, setPublishing] = useState(false);
  const { pickFromGallery, loading: mediaLoading } = useMediaPicker();

  const handleAddMedia = async () => {
    const media = await pickFromGallery();
    if (media) setSelectedMedia(media);
  };

  const handlePublish = async () => {
    if ((!text.trim() && !selectedMedia) || !user) return;
    setPublishing(true);
    try {
      const docRef = await db.collection('posts').add({
        text: text.trim() || '',
        senderId: user.uid,
        senderName: user.displayName || 'Anônimo',
        senderPhoto: user.photoURL || null,
        mediaType: selectedMedia?.type || null,
        timestamp: new Date(),
        likesCount: 0,
        commentsCount: 0,
      });

      if (selectedMedia) {
        const uploadUri = await compressVideo(selectedMedia.uri);
        const result = await uploadEncryptedPostMedia(docRef.id, uploadUri, selectedMedia.type);
        if (result) {
          await db.collection('posts').doc(docRef.id).update({
            mediaUrl: result.mediaUrl,
            mediaKey: result.mediaKey,
            mediaIv: result.mediaIv,
          });
        }
      }

      navigation.goBack();
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível publicar');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        <TextInput
          style={styles.input}
          placeholder="O que você está pensando?"
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={setText}
          multiline
        />

        {selectedMedia && (
          <View style={styles.mediaPreview}>
            {selectedMedia.type === 'video' ? (
              <View style={styles.videoThumb}>
                <Ionicons name="videocam" size={28} color={colors.accent} />
                <Text style={styles.videoLabel}>Vídeo</Text>
              </View>
            ) : (
              <Image source={selectedMedia.uri} style={styles.thumbnail} contentFit="cover" transition={200} />
            )}
            <TouchableOpacity onPress={() => setSelectedMedia(null)}>
              <Text style={styles.removeMedia}>Remover</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.mediaButton} onPress={handleAddMedia} disabled={mediaLoading}>
          <Text style={styles.mediaButtonText}>📷 Adicionar mídia</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.publishButton, publishing && styles.disabled]}
          onPress={handlePublish}
          disabled={publishing || (!text.trim() && !selectedMedia)}
        >
          {publishing ? (
            <ActivityIndicator color={colors.bg} />
          ) : (
            <Text style={styles.publishText}>Publicar</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  input: {
    backgroundColor: colors.elevated,
    color: colors.text,
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
    backgroundColor: colors.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoLabel: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  removeMedia: {
    color: colors.destructive,
    fontSize: 14,
    fontWeight: '600',
  },
  mediaButton: {
    backgroundColor: colors.elevated,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  mediaButtonText: {
    color: colors.text,
    fontSize: 16,
  },
  publishButton: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  publishText: {
    color: colors.bg,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
