import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { useMediaPicker } from '../hooks/useMediaPicker';
import { postStory } from '../services/stories';
import { colors } from '../theme/colors';

const SCREEN_WIDTH = Dimensions.get('window').width;
const BG_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#FFB347'];
const EMOJIS = ['😀', '😂', '🥰', '😎', '🎉', '❤️', '🔥', '👍', '👏', '💪', '🙏', '✨', '🌟', '💫', '⭐', '🌈', '🎨', '🎵', '🎶', '💜', '🦋', '🌺', '🌸', '🌻', '🍀', '🌊', '⛰️'];

export default function CreateStoryScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [media, setMedia] = useState<{ uri: string; type: string } | null>(null);
  const [text, setText] = useState('');
  const [bgColor, setBgColor] = useState(BG_COLORS[0]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const { pickFromGallery, takePhoto, loading: mediaLoading } = useMediaPicker();

  const handlePickMedia = async () => {
    const m = await pickFromGallery();
    if (m) setMedia(m);
  };

  const handleTakePhoto = async () => {
    const m = await takePhoto();
    if (m) setMedia(m);
  };

  const handleEmojiPick = (emoji: string) => {
    setText((prev) => prev + emoji);
  };

  const handlePublish = async () => {
    if (!user || (!media && !text.trim())) return;
    setPublishing(true);
    try {
      await postStory(user.uid, user.displayName || 'Anônimo', {
        mediaUri: media?.uri,
        mediaType: media?.type.startsWith('video') ? 'video' : 'image',
        text: text.trim() || undefined,
        bgColor: media ? undefined : bgColor,
      });
      navigation.goBack();
    } catch {
      Alert.alert('Erro', 'Não foi possível publicar o status');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.preview, media ? null : { backgroundColor: bgColor }]}>
          {media ? (
            <Image source={{ uri: media.uri }} style={styles.previewImage} resizeMode="cover" />
          ) : (
            <Text style={[styles.previewText, { color: isLightColor(bgColor) ? '#1a1a2e' : '#fff' }]}>
              {text || 'Toque abaixo\ne digite algo'}
            </Text>
          )}
        </View>

        {!media && (
          <>
            <Text style={styles.sectionTitle}>Cor de fundo</Text>
            <View style={styles.colorRow}>
              {BG_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorDot, { backgroundColor: c }, bgColor === c && styles.colorDotActive]}
                  onPress={() => setBgColor(c)}
                />
              ))}
            </View>
          </>
        )}

        <View style={styles.inputRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={handlePickMedia} disabled={mediaLoading}>
            <Text style={styles.iconText}>📷</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={handleTakePhoto} disabled={mediaLoading}>
            <Text style={styles.iconText}>📸</Text>
          </TouchableOpacity>
          {!media && (
            <TouchableOpacity style={styles.iconBtn} onPress={() => setShowEmojiPicker(!showEmojiPicker)}>
              <Text style={styles.iconText}>😊</Text>
            </TouchableOpacity>
          )}
          {media && (
            <TouchableOpacity onPress={() => setMedia(null)}>
              <Text style={styles.removeText}>Remover</Text>
            </TouchableOpacity>
          )}
        </View>

        {showEmojiPicker && !media && (
          <View style={styles.emojiGrid}>
            {EMOJIS.map((emoji, idx) => (
              <TouchableOpacity key={idx} style={styles.emojiItem} onPress={() => handleEmojiPick(emoji)}>
                <Text style={styles.emojiText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TextInput
          style={styles.textInput}
          placeholder="Digite algo..."
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={setText}
          multiline
        />

        <TouchableOpacity
          style={[styles.publishButton, publishing && styles.disabled]}
          onPress={handlePublish}
          disabled={publishing || (!media && !text.trim())}
        >
          {publishing ? (
            <ActivityIndicator color={colors.bg} />
          ) : (
            <Text style={styles.publishText}>Publicar Status</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function isLightColor(hex: string): boolean {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 155;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    padding: 16,
  },
  preview: {
    width: '100%',
    height: SCREEN_WIDTH * 1.2,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewText: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 40,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  colorDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorDotActive: {
    borderColor: colors.accent,
    borderWidth: 3,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 20,
  },
  removeText: {
    color: colors.destructive,
    fontSize: 14,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    backgroundColor: colors.elevated,
    borderRadius: 12,
    padding: 8,
    marginBottom: 12,
  },
  emojiItem: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiText: {
    fontSize: 24,
  },
  textInput: {
    backgroundColor: colors.elevated,
    color: colors.text,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
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
