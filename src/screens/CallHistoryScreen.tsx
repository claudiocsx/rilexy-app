import { useState, useEffect, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { getColors } from '../theme/colors';
import { useSettingsStore } from '../store/settingsStore';
import EmptyState from '../components/EmptyState';
import { observeCallHistory, CallRecord } from '../services/callHistory';

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatTimestamp(ts: Date): string {
  const now = Date.now();
  const diff = now - ts.getTime();
  if (diff < 60000) return 'Agora';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  const days = Math.floor(diff / 86400000);
  if (days < 7) return `${days}d`;
  return ts.toLocaleDateString('pt-BR');
}

export default function CallHistoryScreen() {
  const theme = useSettingsStore((s) => s.theme);
  const c = getColors(theme);
  const styles = useMemo(() => getStyles(c), [c]);
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [records, setRecords] = useState<CallRecord[]>([]);

  useEffect(() => {
    if (!user) return;
    return observeCallHistory(user.uid, 100, setRecords);
  }, [user]);

  const renderItem = ({ item }: { item: CallRecord }) => {
    const isMissed = item.status === 'missed';
    const isIncoming = item.direction === 'incoming';
    const icon = item.type === 'video' ? 'videocam-outline' : 'call-outline';
    const iconColor = isMissed ? '#E11D48' : isIncoming ? c.accent : '#22C55E';
    const label = isMissed ? 'Chamada perdida' : isIncoming ? 'Chamada recebida' : 'Chamada realizada';

    return (
      <TouchableOpacity
        style={styles.recordRow}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('UserProfile', { userId: item.peerId })}
      >
        <View style={[styles.avatarSmall]}>
          <Text style={styles.avatarSmallText}>{(item.peerName || '?')[0].toUpperCase()}</Text>
        </View>
        <View style={styles.recordInfo}>
          <Text style={styles.peerName}>{item.peerName || 'Desconhecido'}</Text>
          <View style={styles.recordMeta}>
            <Ionicons name={icon} size={14} color={iconColor} />
            <Text style={[styles.statusText, { color: iconColor }]}>{label}</Text>
            {item.status === 'answered' && (
              <Text style={styles.durationText}>{formatDuration(item.duration)}</Text>
            )}
          </View>
        </View>
        <Text style={styles.timestamp}>{formatTimestamp(item.timestamp)}</Text>
      </TouchableOpacity>
    );
  };

  if (records.length === 0) {
    return <EmptyState icon="call-outline" title="Nenhuma chamada recente" subtitle="Suas chamadas aparecerão aqui" />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingVertical: 8 }}
      />
    </View>
  );
}

function getStyles(c: ReturnType<typeof getColors>) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    color: c.textMuted,
    fontSize: 16,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  avatarSmall: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: c.accentDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarSmallText: {
    color: c.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  recordInfo: {
    flex: 1,
  },
  peerName: {
    color: c.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  recordMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: 13,
  },
  durationText: {
    color: c.textMuted,
    fontSize: 13,
  },
  timestamp: {
    color: c.textMuted,
    fontSize: 13,
  },
  });
}
