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

const WAVE_BARS = 24;
const WAVE_INDICES = Array.from({ length: WAVE_BARS }, (_, i) => i);

export default function AudioMessage({ uri, duration, isMine }: Props) {
  const [player, setPlayer] = useState<AudioPlayer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const mountedRef = useRef(true);
  const listenerRef = useRef<any>(null);
  const waveAnims = useRef(WAVE_INDICES.map(() => new Animated.Value(0.3))).current;

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

  const waveAnim = useRef<Animated.CompositeAnimation | null>(null);

  const startWaveAnim = () => {
    waveAnim.current?.stop();
    waveAnim.current = Animated.loop(
      Animated.parallel(
        waveAnims.map((anim, i) =>
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 0.8 + Math.random() * 0.5,
              duration: 300 + Math.random() * 200,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0.3,
              duration: 300 + Math.random() * 200,
              useNativeDriver: true,
            }),
          ])
        )
      )
    );
    waveAnim.current.start();
  };

  const stopWaveAnim = () => {
    waveAnim.current?.stop();
    waveAnim.current = null;
    waveAnims.forEach((anim) => anim.setValue(0.3));
  };

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
      stopWaveAnim();
    }
  };

  const togglePlay = async () => {
    if (!player) return;
    try {
      if (isPlaying) {
        player.pause();
        setIsPlaying(false);
        stopWaveAnim();
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
        startWaveAnim();
        activePlayerRef = { player, pause: () => { player.pause(); setIsPlaying(false); stopWaveAnim(); } };
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
        <View style={styles.waveContainer}>
          {WAVE_INDICES.map((i) => {
            const anim = waveAnims[i];
            return (
              <Animated.View
                key={i}
                style={[
                  styles.waveBar,
                  {
                    height: anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [8, 20],
                    }),
                    opacity: anim,
                    backgroundColor: isMine ? 'rgba(255,255,255,0.5)' : colors.accent,
                  },
                ]}
              />
            );
          })}
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
    minWidth: 200,
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
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 4,
  },
  progressBarMine: {
    backgroundColor: colors.bg,
  },
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 6,
    height: 20,
  },
  waveBar: {
    flex: 1,
    borderRadius: 2,
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
