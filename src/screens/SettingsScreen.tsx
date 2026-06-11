import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { getCacheSize, clearCache } from '../services/mediaCache';
import { useSettingsStore, AutoDownload } from '../store/settingsStore';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
}

const AUTO_DOWNLOAD_OPTIONS: AutoDownload[] = ['always', 'wifi', 'never'];

export default function SettingsScreen() {
  const autoDownload = useSettingsStore((s) => s.autoDownload);
  const setAutoDownload = useSettingsStore((s) => s.setAutoDownload);
  const [cacheSize, setCacheSize] = useState(0);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    getCacheSize().then(setCacheSize).catch(() => {});
  }, []);

  const handleClearCache = () => {
    Alert.alert(
      'Limpar cache',
      `Excluir ${formatBytes(cacheSize)} de mídias em cache?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar',
          style: 'destructive',
          onPress: async () => {
            setClearing(true);
            try {
              await clearCache();
              setCacheSize(0);
            } catch {
              Alert.alert('Erro', 'Não foi possível limpar o cache');
            } finally {
              setClearing(false);
            }
          },
        },
      ]
    );
  };

  const autoLabel: Record<AutoDownload, string> = {
    always: 'Sempre',
    wifi: 'Apenas Wi-Fi',
    never: 'Nunca',
  };

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Mídia</Text>

        <View style={styles.row}>
          <Ionicons name="download-outline" size={22} color={colors.accent} />
          <Text style={styles.rowLabel}>Download automático</Text>
        </View>
        <View style={styles.optionsRow}>
          {AUTO_DOWNLOAD_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[styles.optionChip, autoDownload === opt && styles.optionChipActive]}
              onPress={() => setAutoDownload(opt)}
            >
              <Text style={[styles.optionChipText, autoDownload === opt && styles.optionChipTextActive]}>
                {autoLabel[opt]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cache</Text>

        <View style={styles.row}>
          <Ionicons name="archive-outline" size={22} color={colors.accent} />
          <Text style={styles.rowLabel}>Mídias em cache</Text>
          <Text style={styles.rowValue}>{formatBytes(cacheSize)}</Text>
        </View>

        <TouchableOpacity
          style={[styles.clearButton, clearing && styles.disabled]}
          onPress={handleClearCache}
          disabled={clearing || cacheSize === 0}
        >
          <Ionicons name="trash-outline" size={18} color={colors.destructive} />
          <Text style={styles.clearButtonText}>
            {clearing ? 'Limpando...' : 'Limpar cache'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sobre</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Versão</Text>
          <Text style={styles.rowValue}>1.0.0</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 16,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  sectionTitle: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  rowLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
  },
  rowValue: {
    color: colors.textMuted,
    fontSize: 14,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  optionChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  optionChipActive: {
    backgroundColor: colors.accentDark,
    borderColor: colors.accent,
  },
  optionChipText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  optionChipTextActive: {
    color: colors.text,
    fontWeight: 'bold',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.destructive,
    marginTop: 8,
  },
  clearButtonText: {
    color: colors.destructive,
    fontSize: 15,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
});
