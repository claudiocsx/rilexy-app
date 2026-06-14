import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface CallStatusBarProps {
  duration: number;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'unknown';
  status: string;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const qualityConfig = {
  excellent: { icon: 'wifi' as const, color: '#22c55e', label: 'Excelente' },
  good: { icon: 'wifi' as const, color: '#eab308', label: 'Boa' },
  poor: { icon: 'warning' as const, color: '#ef4444', label: 'Ruim' },
  unknown: { icon: 'remove' as const, color: colors.textMuted, label: '' },
};

export default function CallStatusBar({ duration, connectionQuality, status }: CallStatusBarProps) {
  if (status !== 'connected') return null;

  const q = qualityConfig[connectionQuality];

  return (
    <View style={styles.container}>
      <Text style={styles.timer}>{formatDuration(duration)}</Text>
      {connectionQuality !== 'unknown' && (
        <View style={styles.quality}>
          <Ionicons name={q.icon} size={14} color={q.color} />
          <Text style={[styles.qualityText, { color: q.color }]}>{q.label}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  timer: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  quality: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  qualityText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
