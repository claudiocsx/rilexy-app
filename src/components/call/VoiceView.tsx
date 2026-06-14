import { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface VoiceViewProps {
  peerName: string;
  status: string;
  duration: number;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function getStatusText(status: string): string {
  switch (status) {
    case 'connecting': return 'Conectando...';
    case 'ringing': return 'Chamando...';
    case 'connected': return '';
    default: return '';
  }
}

export default function VoiceView({ peerName, status, duration }: VoiceViewProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (status === 'ringing') {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      anim.start();
      return () => anim.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [status]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.avatarRing,
          status === 'ringing' && { transform: [{ scale: pulseAnim }] },
        ]}
      >
        <View style={[styles.avatarBg, status === 'ringing' && styles.avatarBgGlow]}>
          <Ionicons name="person" size={72} color={colors.text} />
        </View>
      </Animated.View>

      <Text style={styles.name}>{peerName}</Text>

      {status === 'connected' ? (
        <Text style={styles.timer}>{formatDuration(duration)}</Text>
      ) : (
        <Text style={styles.status}>{getStatusText(status)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  avatarRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarBg: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarBgGlow: {
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  name: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  status: {
    color: colors.textMuted,
    fontSize: 16,
  },
  timer: {
    color: colors.accent,
    fontSize: 20,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
});
