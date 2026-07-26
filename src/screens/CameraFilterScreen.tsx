import { useState, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions, type CameraCapturedPicture } from 'expo-camera';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { postStory } from '../services/stories';
import { CAMERA_FILTERS } from '../data/cameraFilters';
import CameraFilter from '../components/CameraFilter';
import { getColors } from '../theme/colors';
import { useSettingsStore } from '../store/settingsStore';
import { useToast } from '../components/Toast';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function CameraFilterScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const theme = useSettingsStore((s) => s.theme);
  const c = getColors(theme);
  const styles = useMemo(() => getStyles(c), [c]);

  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [flash, setFlash] = useState<'off' | 'on' | 'auto'>('off');
  const [selectedFilterIdx, setSelectedFilterIdx] = useState(0);
  const [capturedPhoto, setCapturedPhoto] = useState<CameraCapturedPicture | null>(null);
  const [capturedVideo, setCapturedVideo] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const cameraRef = useRef<CameraView>(null);
  const recordingRef = useRef(false);
  const recordingStartRef = useRef(0);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);

  const activeFilter = CAMERA_FILTERS[selectedFilterIdx];

  const videoPlayer = useVideoPlayer(capturedVideo, (player) => {
    player.loop = false;
  });

  const takePicture = useCallback(async () => {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
    if (photo) setCapturedPhoto(photo);
  }, []);

  const startRecording = useCallback(async () => {
    if (!cameraRef.current || recordingRef.current) return;
    recordingRef.current = true;
    setRecording(true);
    setRecordingDuration(0);
    recordingStartRef.current = Date.now();

    durationTimerRef.current = setInterval(() => {
      setRecordingDuration(Math.floor((Date.now() - recordingStartRef.current) / 1000));
    }, 200);

    try {
      const result = await cameraRef.current.recordAsync({ maxDuration: 60 });
      if (result?.uri) {
        setCapturedVideo(result.uri);
      }
    } catch {
      showToast('Erro ao gravar vídeo', 'error');
    } finally {
      recordingRef.current = false;
      setRecording(false);
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    }
  }, [showToast]);

  const stopRecording = useCallback(() => {
    if (!recordingRef.current) return;
    cameraRef.current?.stopRecording();
  }, []);

  const handlePressIn = () => {
    isLongPressRef.current = false;
    pressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      startRecording();
    }, 300);
  };

  const handlePressOut = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    if (isLongPressRef.current) {
      stopRecording();
    } else {
      takePicture();
    }
  };

  const handlePublish = async () => {
    if (!user) return;
    setPublishing(true);
    try {
      if (capturedVideo) {
        await postStory(user.uid, user.displayName || 'Anônimo', {
          mediaUri: capturedVideo,
          mediaType: 'video',
        });
      } else if (capturedPhoto) {
        await postStory(user.uid, user.displayName || 'Anônimo', {
          mediaUri: capturedPhoto.uri,
          mediaType: 'image',
        });
      }
      navigation.goBack();
    } catch {
      showToast('Erro ao publicar momento', 'error');
    } finally {
      setPublishing(false);
    }
  };

  const discardMedia = () => {
    setCapturedPhoto(null);
    setCapturedVideo(null);
  };

  const toggleFacing = () => setFacing((f) => f === 'back' ? 'front' : 'back');

  const cycleFlash = () => {
    setFlash((f) => f === 'off' ? 'on' : f === 'on' ? 'auto' : 'off');
  };

  const flashIcon = flash === 'off' ? 'flash-off' : flash === 'on' ? 'flash' : 'flash-auto';

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (!permission) return null;
  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera-outline" size={64} color={c.textMuted} />
        <Text style={styles.permissionText}>Precisamos de acesso à câmera</Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>Permitir</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (capturedPhoto) {
    return (
      <View style={styles.previewContainer}>
        <StatusBar hidden />
        <Image source={{ uri: capturedPhoto.uri }} style={styles.previewImage} />
        <CameraFilter filter={activeFilter} />
        <View style={styles.previewActions}>
          <TouchableOpacity style={styles.previewBtn} onPress={discardMedia}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.previewPublish, publishing && styles.disabled]}
            onPress={handlePublish}
            disabled={publishing}
          >
            {publishing ? (
              <ActivityIndicator color={c.bg} />
            ) : (
              <Text style={styles.previewPublishText}>Publicar Momento</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (capturedVideo) {
    return (
      <View style={styles.previewContainer}>
        <StatusBar hidden />
        <VideoView
          player={videoPlayer}
          style={styles.previewVideo}
          contentFit="contain"
          nativeControls
        />
        <CameraFilter filter={activeFilter} />
        <View style={styles.previewActions}>
          <TouchableOpacity style={styles.previewBtn} onPress={discardMedia}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.previewPublish, publishing && styles.disabled]}
            onPress={handlePublish}
            disabled={publishing}
          >
            {publishing ? (
              <ActivityIndicator color={c.bg} />
            ) : (
              <Text style={styles.previewPublishText}>Publicar Momento</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        flash={flash}
        mode="video"
        mirror={facing === 'front'}
      />
      <CameraFilter filter={activeFilter} />

      <SafeAreaView style={styles.topBar}>
        <TouchableOpacity accessibilityLabel="Fechar" onPress={() => navigation.goBack()} style={styles.topBtn}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        {recording ? (
          <View style={styles.recordingIndicator}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingTimer}>{formatDuration(recordingDuration)}</Text>
          </View>
        ) : (
          <TouchableOpacity accessibilityLabel="Alternar flash" onPress={cycleFlash} style={styles.topBtn}>
            <Ionicons name={flashIcon as any} size={24} color="#fff" />
          </TouchableOpacity>
        )}
      </SafeAreaView>

      <SafeAreaView style={styles.bottomBar}>
        {!recording && (
          <View style={styles.filterRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
              {CAMERA_FILTERS.map((filter, idx) => (
                <TouchableOpacity
                  key={filter.id}
                  accessibilityLabel={filter.name}
                  style={[
                    styles.filterItem,
                    idx === selectedFilterIdx && styles.filterItemActive,
                  ]}
                  onPress={() => setSelectedFilterIdx(idx)}
                >
                  <View style={[styles.filterThumb, { backgroundColor: filter.overlayColor !== 'transparent' ? filter.overlayColor : '#555' }]} />
                  <Text style={[styles.filterName, idx === selectedFilterIdx && styles.filterNameActive]}>
                    {filter.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.shutterRow}>
          <View style={styles.shutterSide} />
          <TouchableOpacity
            accessibilityLabel={recording ? 'Parar gravação' : 'Capturar'}
            style={[styles.shutter, recording && styles.shutterRecording]}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={0.7}
          >
            <View style={[styles.shutterInner, recording && styles.shutterInnerRecording]} />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel="Virar câmera"
            onPress={toggleFacing}
            style={styles.shutterSide}
            disabled={recording}
          >
            <Ionicons name="camera-reverse" size={28} color={recording ? 'rgba(255,255,255,0.3)' : '#fff'} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

function getStyles(c: ReturnType<typeof getColors>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000',
    },
    camera: {
      ...StyleSheet.absoluteFillObject,
    },
    permissionContainer: {
      flex: 1,
      backgroundColor: c.bg,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 16,
      padding: 32,
    },
    permissionText: {
      color: c.text,
      fontSize: 16,
      textAlign: 'center',
    },
    permissionBtn: {
      backgroundColor: c.accent,
      paddingHorizontal: 32,
      paddingVertical: 12,
      borderRadius: 24,
    },
    permissionBtnText: {
      color: c.bg,
      fontSize: 16,
      fontWeight: 'bold',
    },
    topBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    topBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    recordingIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: 'rgba(0,0,0,0.5)',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
    },
    recordingDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: '#ff3b30',
    },
    recordingTimer: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
    },
    bottomBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
    },
    filterRow: {
      paddingBottom: 8,
    },
    filterScroll: {
      paddingHorizontal: 16,
      gap: 12,
      alignItems: 'center',
    },
    filterItem: {
      alignItems: 'center',
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 20,
    },
    filterItemActive: {
      backgroundColor: 'rgba(255,255,255,0.2)',
    },
    filterThumb: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.5)',
    },
    filterName: {
      color: 'rgba(255,255,255,0.7)',
      fontSize: 11,
    },
    filterNameActive: {
      color: '#fff',
      fontWeight: '600',
    },
    shutterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 32,
      paddingBottom: 32,
    },
    shutterSide: {
      width: 50,
      height: 50,
      justifyContent: 'center',
      alignItems: 'center',
    },
    shutter: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: 'rgba(255,255,255,0.3)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    shutterRecording: {
      backgroundColor: 'rgba(255,59,48,0.4)',
    },
    shutterInner: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: '#fff',
      borderWidth: 3,
      borderColor: 'rgba(0,0,0,0.1)',
    },
    shutterInnerRecording: {
      width: 28,
      height: 28,
      borderRadius: 6,
      backgroundColor: '#ff3b30',
      borderWidth: 0,
    },
    previewContainer: {
      flex: 1,
      backgroundColor: '#000',
    },
    previewImage: {
      ...StyleSheet.absoluteFillObject,
    },
    previewVideo: {
      ...StyleSheet.absoluteFillObject,
    },
    previewActions: {
      position: 'absolute',
      bottom: 50,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    previewBtn: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    previewPublish: {
      backgroundColor: c.accent,
      paddingHorizontal: 32,
      paddingVertical: 14,
      borderRadius: 24,
    },
    previewPublishText: {
      color: c.bg,
      fontSize: 16,
      fontWeight: 'bold',
    },
    disabled: {
      opacity: 0.5,
    },
  });
}