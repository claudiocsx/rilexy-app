import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { createAudioPlayer, AudioPlayer, AudioStatus } from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

interface Props {
  uri: string;
  duration: number;
  isMine: boolean;
}

let activePlayerRef: { player: AudioPlayer; pause: () => void } | null = null;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function AudioMessage({ uri, duration, isMine }: Props) {
  const [player, setPlayer] = useState<AudioPlayer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const mountedRef = useRef(true);
  const listenerRef = useRef<any>(null);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    loadSound();
    return () => {
      if (listenerRef.current) {
        listenerRef.current.remove();
        listenerRef.current = null;
      }
      if (player) {
        player.remove();
      }
    };
  }, [uri]);

  const loadSound = async () => {
    try {
      if (player) {
        player.remove();
      }
      const newPlayer = createAudioPlayer({ uri });
      if (mountedRef.current) {
        setPlayer(newPlayer);
        listenerRef.current = newPlayer.addListener('playbackStatusUpdate', onPlaybackStatusUpdate);
      }
    } catch (e) {
      console.error('Audio load error:', e);
    }
  };

  const onPlaybackStatusUpdate = (status: AudioStatus) => {
    if (!status.isLoaded) return;
    const pct = status.duration ? status.currentTime / status.duration : 0;
    setProgress(pct);
    Animated.timing(progressAnim, {
      toValue: pct,
      duration: 100,
      useNativeDriver: false,
    }).start();
    if (status.didJustFinish) {
      setIsPlaying(false);
      setProgress(0);
      progressAnim.setValue(0);
    }
  };

  const togglePlay = async () => {
    if (!player) return;
    try {
      if (isPlaying) {
        player.pause();
        setIsPlaying(false);
        if (activePlayerRef?.player === player) activePlayerRef = null;
      } else {
        if (activePlayerRef && activePlayerRef.player !== player) {
          activePlayerRef.pause();
        }
        if (progress >= 1) {
          await player.seekTo(0);
          setProgress(0);
          progressAnim.setValue(0);
        }
        player.play();
        setIsPlaying(true);
        activePlayerRef = { player, pause: () => { player.pause(); setIsPlaying(false); } };
      }
    } catch (e) {
      console.error('Audio play error:', e);
    }
  };

  const barWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[styles.container, isMine && styles.mine]}>
      <TouchableOpacity onPress={togglePlay} style={styles.playButton}>
        <Ionicons
          name={isPlaying ? 'pause-circle' : 'play-circle'}
          size={28}
          color={isMine ? colors.bg : colors.accent}
        />
      </TouchableOpacity>
      <View style={styles.info}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressBar, { width: barWidth }, isMine && styles.progressBarMine]} />
        </View>
        <Text style={[styles.duration, isMine && styles.durationMine]}>
          {formatTime(progress * duration)} / {formatTime(duration)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    minWidth: 180,
  },
  mine: {},
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  progressBarMine: {
    backgroundColor: colors.bg,
  },
  duration: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  durationMine: {
    color: 'rgba(255,255,255,0.7)',
  },
});
