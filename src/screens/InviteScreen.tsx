import { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { validarCodigo } from '../services/convites';
import { getColors } from '../theme/colors';
import { useSettingsStore } from '../store/settingsStore';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Invite'>;

export default function InviteScreen() {
  const navigation = useNavigation<Nav>();
  const [codigo, setCodigo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<TextInput>(null);
  const theme = useSettingsStore((s) => s.theme);
  const c = getColors(theme);
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => getStyles(c), [c]);

  const handleSubmit = async () => {
    const trimmed = codigo.trim().toUpperCase();
    if (!trimmed) {
      setError('Digite um código de convite');
      return;
    }
    setLoading(true);
    setError('');
    const validacao = await validarCodigo(trimmed);
    if (!validacao.valido) {
      setError(validacao.mensagem || 'Código inválido');
      setLoading(false);
      return;
    }
    setLoading(false);
    navigation.replace('Register', { inviteCode: trimmed });
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 44 : 0}>
      <View style={styles.content}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>♀♂</Text>
        </View>
        <Text style={styles.title}>Rilaxy</Text>
        <Text style={styles.subtitle}>Insira seu código de convite</Text>

        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder="Código de convite"
          placeholderTextColor={c.textMuted}
          value={codigo}
          onChangeText={(t) => { setCodigo(t.toUpperCase()); setError(''); }}
          autoCapitalize="characters"
          autoFocus
          accessibilityLabel="Código de convite"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, !codigo.trim() && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!codigo.trim() || loading}
        >
          {loading ? (
            <ActivityIndicator color={c.bg} size="small" />
          ) : (
            <Text style={styles.buttonText}>Entrar</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.replace('Login', {})}>
          <Text style={styles.link}>Já tem conta? Fazer login</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function getStyles(c: ReturnType<typeof getColors>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.bg,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
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
      marginBottom: 20,
    },
    logoText: {
      color: c.accent,
      fontSize: 30,
      fontWeight: 'bold',
    },
    title: {
      fontSize: 42,
      fontWeight: 'bold',
      color: c.accent,
      textAlign: 'center',
      letterSpacing: 3,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 15,
      color: c.textMuted,
      textAlign: 'center',
      marginBottom: 32,
    },
    input: {
      width: '100%',
      backgroundColor: c.glassBgLighter,
      color: c.text,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 20,
      borderWidth: 1,
      borderColor: c.glassBorder,
      textAlign: 'center',
      letterSpacing: 4,
      marginBottom: 8,
    },
    error: {
      color: c.destructive,
      fontSize: 13,
      textAlign: 'center',
      marginBottom: 8,
    },
    button: {
      width: '100%',
      backgroundColor: c.accent,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 8,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: c.bg,
      fontSize: 16,
      fontWeight: 'bold',
    },
    link: {
      color: c.accent,
      textAlign: 'center',
      marginTop: 24,
      fontSize: 14,
    },
  });
}