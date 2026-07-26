import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getColors } from '../theme/colors';
import { useSettingsStore } from '../store/settingsStore';

export default function AguardandoAprovacaoScreen() {
  const theme = useSettingsStore((s) => s.theme);
  const c = getColors(theme);
  const styles = useMemo(() => getStyles(c), [c]);

  return (
    <View style={styles.container}>
      <View style={styles.logo}>
        <Text style={styles.logoText}>♀♂</Text>
      </View>
      <Ionicons name="time-outline" size={48} color={c.accent} style={{ marginTop: 24 }} />
      <Text style={styles.title}>Aguardando Aprovação</Text>
      <Text style={styles.subtitle}>
        Sua conta foi criada e está aguardando aprovação do administrador.{'\n\n'}
        Você receberá um aviso quando for aprovado.
      </Text>
    </View>
  );
}

function getStyles(c: ReturnType<typeof getColors>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.bg,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    logo: {
      width: 80,
      height: 80,
      borderRadius: 40,
      borderWidth: 3,
      borderColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoText: {
      color: c.accent,
      fontSize: 30,
      fontWeight: 'bold',
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: c.accent,
      textAlign: 'center',
      marginTop: 16,
    },
    subtitle: {
      fontSize: 15,
      color: c.textMuted,
      textAlign: 'center',
      marginTop: 16,
      lineHeight: 22,
    },
  });
}
