import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { File, Directory, Paths } from 'expo-file-system';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettingsStore, VideoStickerMeta } from '../store/settingsStore';
import { uploadMedia } from '../services/storage';
import { getColors } from '../theme/colors';
import { generateId } from '../utils/generateId';
import { useToast } from '../components/Toast';

export default function CreateVideoStickerScreen() {
  const theme = useSettingsStore((s) => s.theme);
  const c = getColors(theme);
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => getStyles(c), [c]);
  const navigation = useNavigation();
  const { showToast } = useToast();
  const addVideoSticker = useSettingsStore((s) => s.addVideoSticker);
  const barRef = useRef<View>(null);

  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [barWidth, setBarWidth] = useState(0);

  const player = useVideoPlayer(videoUri ? { uri: videoUri } : null, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    (async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Precisamos acessar sua galeria para criar figurinhas.');
        navigation.goBack();
      }
    })();
  }, []);

  useEffect(() => {
    if (videoUri) return;
    pickVideo();
  }, [videoUri]);

  useEffect(() => {
    if (!player) return;
    const interval = setInterval(() => {
      const d = player.duration;
      if (d && d > 0 && !isNaN(d)) {
        setDuration(d);
        setTrimEnd(Math.min(d, 3));
        clearInterval(interval);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [player]);

  useEffect(() => {
    if (player && trimStart != null) player.currentTime = trimStart;
  }, [trimStart, player]);

  useEffect(() => {
    if (!player || trimEnd == null) return;
    const interval = setInterval(() => {
      if (player.currentTime >= trimEnd) player.currentTime = (trimStart ?? 0);
    }, 200);
    return () => clearInterval(interval);
  }, [player, trimStart, trimEnd]);

  const pickVideo = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: true,
      videoMaxDuration: 10,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) {
      if (!videoUri) navigation.goBack();
      return;
    }
    setVideoUri(result.assets[0].uri);
  }, [videoUri]);

  const draggingStart = useRef<boolean | null>(null);

  const timeFromX = useCallback((locationX: number) => {
    if (!barWidth || !duration) return 0;
    const x = Math.max(0, Math.min(locationX, barWidth));
    return (x / barWidth) * duration;
  }, [barWidth, duration]);

  const onTimelineGrant = useCallback((e: any) => {
    const x = e.nativeEvent.locationX;
    const t = timeFromX(x);
    const distStart = Math.abs(t - trimStart);
    const distEnd = Math.abs(t - trimEnd);
    draggingStart.current = distStart <= distEnd;
    onTimelineMove(e);
  }, [timeFromX, trimStart, trimEnd]);

  const onTimelineMove = useCallback((e: any) => {
    const t = timeFromX(e.nativeEvent.locationX);
    if (draggingStart.current) {
      setTrimStart(Math.max(0, Math.min(t, trimEnd - 0.3)));
    } else {
      setTrimEnd(Math.max(trimStart + 0.3, Math.min(t, duration)));
    }
  }, [timeFromX, trimStart, trimEnd, duration]);

  const handleSave = useCallback(async () => {
    if (!videoUri || !name.trim()) return;
    setSaving(true);
    try {
      const id = await generateId();
      const ext = videoUri.split('.').pop()?.split('?')[0] || 'mp4';
      const localName = `${id}.${ext}`;

      const stickersDir = new Directory(Paths.document, 'rilaxy-stickers');
      await stickersDir.create({ intermediates: true, idempotent: true });

      const src = new File(videoUri);
      const dest = new File(stickersDir, localName);
      src.copy(dest);
      const localUrl = dest.uri;

      const remoteUrl = await uploadMedia(videoUri, `rilaxy-stickers/${id}.${ext}`);

      const meta: VideoStickerMeta = {
        id,
        emoji: '🎬',
        name: name.trim(),
        videoUrl: remoteUrl || localUrl,
        trimStart: Math.round(trimStart * 10) / 10,
        trimEnd: Math.round(trimEnd * 10) / 10,
      };

      await addVideoSticker(meta);
      navigation.goBack();
    } catch (error: any) {
      showToast(error?.message || 'Não foi possível salvar a figurinha', 'error');
    } finally {
      setSaving(false);
    }
  }, [videoUri, name, trimStart, trimEnd]);

  const hasDuration = duration > 0;
  const startPct = hasDuration ? (trimStart / duration) * 100 : 0;
  const endPct = hasDuration ? (trimEnd / duration) * 100 : 100;
  const rangePct = endPct - startPct;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 44 : 0}>
      <View style={styles.content}>
        {videoUri && (
          <View style={styles.preview}>
            <VideoView
              player={player}
              style={styles.video}
              nativeControls={false}
              contentFit="contain"
            />
          </View>
        )}

        {!videoUri && (
          <View style={styles.loadingPreview}>
            <ActivityIndicator color={c.accent} />
            <Text style={styles.loadingText}>Selecionando vídeo...</Text>
          </View>
        )}

        <TouchableOpacity style={styles.pickBtn} onPress={pickVideo}>
          <Text style={styles.pickBtnText}>Trocar vídeo</Text>
        </TouchableOpacity>

        {hasDuration && (
          <View style={styles.trimSection}>
            <Text style={styles.label}>Cortar</Text>
            <View
              ref={barRef}
              style={styles.timelineBar}
              onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={onTimelineGrant}
              onResponderMove={onTimelineMove}
            >
              <View style={styles.timelineTrack} />
              <View style={[styles.timelineHighlight, { left: `${startPct}%`, width: `${rangePct}%` }]} />
              <View style={[styles.handle, { left: `${startPct}%` }]} />
              <View style={[styles.handle, { left: `${endPct}%` }]} />
            </View>
            <View style={styles.trimLabels}>
              <Text style={styles.trimLabel}>{trimStart.toFixed(1)}s</Text>
              <Text style={styles.trimLabel}>{trimEnd.toFixed(1)}s</Text>
            </View>
            <Text style={styles.trimInfo}>
              Duração: {(trimEnd - trimStart).toFixed(1)}s de {duration.toFixed(1)}s
            </Text>
          </View>
        )}

        <Text style={styles.label}>Nome</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: Dança do gato"
          placeholderTextColor={c.textMuted}
          value={name}
          onChangeText={setName}
          maxLength={30}
        />

        <TouchableOpacity
          style={[styles.saveBtn, (!videoUri || !name.trim() || saving) && styles.disabled]}
          onPress={handleSave}
          disabled={!videoUri || !name.trim() || saving}
        >
          {saving ? (
            <ActivityIndicator color={c.bg} />
          ) : (
            <Text style={styles.saveBtnText}>Salvar Figurinha</Text>
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
    flex: 1,
    padding: 16,
  },
  preview: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: c.surface,
    marginBottom: 8,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  loadingPreview: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    backgroundColor: c.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  loadingText: {
    color: c.textMuted,
    fontSize: 14,
    marginTop: 8,
  },
  pickBtn: {
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: c.elevated,
    marginBottom: 16,
  },
  pickBtnText: {
    color: c.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  trimSection: {
    marginBottom: 16,
  },
  label: {
    color: c.textMuted,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  timelineBar: {
    height: 32,
    justifyContent: 'center',
    position: 'relative',
  },
  timelineTrack: {
    height: 6,
    backgroundColor: c.elevated,
    borderRadius: 3,
  },
  timelineHighlight: {
    position: 'absolute',
    height: 6,
    backgroundColor: c.accent,
    borderRadius: 3,
  },
  handle: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: c.white,
    borderWidth: 2,
    borderColor: c.accent,
    marginLeft: -10,
    marginTop: -7,
    top: '50%',
  },
  trimLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  trimLabel: {
    color: c.textMuted,
    fontSize: 11,
  },
  trimInfo: {
    color: c.textSubtle,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  input: {
    backgroundColor: c.elevated,
    color: c.text,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 24,
  },
  saveBtn: {
    backgroundColor: c.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: c.bg,
    fontSize: 16,
    fontWeight: 'bold',
  },
  });
}
