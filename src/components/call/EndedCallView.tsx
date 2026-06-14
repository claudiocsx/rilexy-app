import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface EndedCallViewProps {
  peerName: string;
  duration: number;
  onClose: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) {
    return `${m} min ${s.toString().padStart(2, '0')}s`;
  }
  return `${s}s`;
}

export default function EndedCallView({ peerName, duration, onClose }: EndedCallViewProps) {
  return (
    <TouchableOpacity
      style={styles.container}
      activeOpacity={1}
      onPress={onClose}
    >
      <View style={styles.avatar}>
        <Ionicons name="person" size={48} color={colors.text} />
      </View>
      <Text style={styles.name}>{peerName}</Text>
      <Text style={styles.ended}>Chamada encerrada</Text>
      {duration > 0 && (
        <Text style={styles.duration}>
          Duração: {formatDuration(duration)}
        </Text>
      )}

      <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
        <Ionicons name="close" size={20} color={colors.text} />
        <Text style={styles.closeLabel}>Fechar</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.elevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  name: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 8,
  },
  ended: {
    color: colors.textMuted,
    fontSize: 16,
    marginBottom: 4,
  },
  duration: {
    color: colors.textSubtle,
    fontSize: 14,
  },
  closeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 32,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.elevated,
  },
  closeLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
});
