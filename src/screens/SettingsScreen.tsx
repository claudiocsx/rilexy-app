import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getColors } from '../theme/colors';
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
  const theme = useSettingsStore((s) => s.theme);
  const toggleTheme = useSettingsStore((s) => s.toggleTheme);
  const [cacheSize, setCacheSize] = useState(0);
  const [clearing, setClearing] = useState(false);
  const c = getColors(theme);

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
    <View style={{ flex: 1, backgroundColor: c.bg, padding: 16 }}>
      <View style={{
        backgroundColor: c.surface, borderRadius: 12, padding: 16, marginBottom: 16,
        borderWidth: 1, borderColor: c.borderLight,
      }}>
        <Text style={{
          color: c.accent, fontSize: 14, fontWeight: 'bold', letterSpacing: 1,
          marginBottom: 16, textTransform: 'uppercase',
        }}>Aparência</Text>
        <TouchableOpacity onPress={toggleTheme} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Ionicons name={theme === 'dark' ? 'moon-outline' : 'sunny-outline'} size={22} color={c.accent} />
          <Text style={{ flex: 1, color: c.text, fontSize: 16 }}>Modo {theme === 'dark' ? 'escuro' : 'claro'}</Text>
          <Text style={{ color: c.textMuted, fontSize: 14 }}>{theme === 'dark' ? '🌙' : '☀️'}</Text>
        </TouchableOpacity>
      </View>

      <View style={{
        backgroundColor: c.surface, borderRadius: 12, padding: 16, marginBottom: 16,
        borderWidth: 1, borderColor: c.borderLight,
      }}>
        <Text style={{
          color: c.accent, fontSize: 14, fontWeight: 'bold', letterSpacing: 1,
          marginBottom: 16, textTransform: 'uppercase',
        }}>Mídia</Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <Ionicons name="download-outline" size={22} color={c.accent} />
          <Text style={{ flex: 1, color: c.text, fontSize: 16 }}>Download automático</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {AUTO_DOWNLOAD_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={{
                paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
                backgroundColor: autoDownload === opt ? c.accentDark : c.elevated,
                borderWidth: 1, borderColor: autoDownload === opt ? c.accent : c.borderLight,
              }}
              onPress={() => setAutoDownload(opt)}
            >
              <Text style={{
                color: autoDownload === opt ? c.text : c.textMuted, fontSize: 14,
                fontWeight: autoDownload === opt ? 'bold' : 'normal',
              }}>
                {autoLabel[opt]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={{
        backgroundColor: c.surface, borderRadius: 12, padding: 16, marginBottom: 16,
        borderWidth: 1, borderColor: c.borderLight,
      }}>
        <Text style={{
          color: c.accent, fontSize: 14, fontWeight: 'bold', letterSpacing: 1,
          marginBottom: 16, textTransform: 'uppercase',
        }}>Cache</Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <Ionicons name="archive-outline" size={22} color={c.accent} />
          <Text style={{ flex: 1, color: c.text, fontSize: 16 }}>Mídias em cache</Text>
          <Text style={{ color: c.textMuted, fontSize: 14 }}>{formatBytes(cacheSize)}</Text>
        </View>

        <TouchableOpacity
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: c.destructive, marginTop: 8,
            opacity: (clearing || cacheSize === 0) ? 0.5 : 1,
          }}
          onPress={handleClearCache}
          disabled={clearing || cacheSize === 0}
        >
          <Ionicons name="trash-outline" size={18} color={c.destructive} />
          <Text style={{ color: c.destructive, fontSize: 15, fontWeight: '600' }}>
            {clearing ? 'Limpando...' : 'Limpar cache'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{
        backgroundColor: c.surface, borderRadius: 12, padding: 16, marginBottom: 16,
        borderWidth: 1, borderColor: c.borderLight,
      }}>
        <Text style={{
          color: c.accent, fontSize: 14, fontWeight: 'bold', letterSpacing: 1,
          marginBottom: 16, textTransform: 'uppercase',
        }}>Sobre</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ flex: 1, color: c.text, fontSize: 16 }}>Versão</Text>
          <Text style={{ color: c.textMuted, fontSize: 14 }}>1.0.0</Text>
        </View>
      </View>
    </View>
  );
}


