import { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, BackHandler } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import { authenticateWithPin, authenticateWithBiometrics, unlockApp, canUseBiometrics, getLockoutRemaining } from '../services/lockService';
import { getColors } from '../theme/colors';
import { useSettingsStore } from '../store/settingsStore';

interface LockScreenProps {
  onUnlocked: () => void;
}

const PIN_LENGTH = 4;

export default function LockScreen({ onUnlocked }: LockScreenProps) {
  const theme = useSettingsStore((s) => s.theme);
  const c = getColors(theme);
  const styles = useMemo(() => getStyles(c), [c]);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const lockoutTimer = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    (async () => {
      const avail = await canUseBiometrics();
      setBiometricAvailable(avail);
      if (avail) {
        const ok = await authenticateWithBiometrics();
        if (ok) {
          await unlockApp();
          onUnlocked();
          return;
        }
      }
    })();
    checkLockout();
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => {
      if (lockoutTimer.current) clearInterval(lockoutTimer.current);
      backHandler.remove();
    };
  }, []);

  const checkLockout = async () => {
    const rem = await getLockoutRemaining();
    if (rem > 0) {
      setLockoutRemaining(rem);
      lockoutTimer.current = setInterval(async () => {
        const r = await getLockoutRemaining();
        setLockoutRemaining(r);
        if (r <= 0) {
          setLockoutRemaining(0);
          if (lockoutTimer.current) clearInterval(lockoutTimer.current);
        }
      }, 1000);
    }
  };

  const handleBiometric = async () => {
    const ok = await authenticateWithBiometrics();
    if (ok) {
      await unlockApp();
      onUnlocked();
    }
  };

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleKeyPress = async (key: string) => {
    if (lockoutRemaining > 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (error) setError('');
    if (key === 'backspace') {
      setPin((prev) => prev.slice(0, -1));
      return;
    }
    if (pin.length >= PIN_LENGTH) return;
    const newPin = pin + key;
    setPin(newPin);

    if (newPin.length === PIN_LENGTH) {
      const valid = await authenticateWithPin(newPin);
      if (valid) {
        await unlockApp();
        onUnlocked();
      } else {
        setPin('');
        shake();
        const rem = await getLockoutRemaining();
        if (rem > 0) {
          setLockoutRemaining(rem);
          checkLockout();
        } else {
          setError('PIN incorreto');
        }
      }
    }
  };

  const formatLockout = (ms: number) => {
    const secs = Math.ceil(ms / 1000);
    return `Tente novamente em ${secs}s`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <View style={styles.lockCircle}>
          <Ionicons name="lock-closed" size={32} color={c.accent} />
        </View>
        <Text style={styles.title}>Rilaxy</Text>
        <Text style={styles.subtitle}>Digite seu PIN para desbloquear</Text>
      </View>

      <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: i < pin.length ? c.accent : c.glassBorder,
                borderColor: i < pin.length ? c.accent : c.borderLight,
              },
            ]}
          />
        ))}
      </Animated.View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {lockoutRemaining > 0 ? (
        <Text style={styles.lockout}>{formatLockout(lockoutRemaining)}</Text>
      ) : null}

      <View style={styles.keypad}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
          <TouchableOpacity
            key={k}
            style={styles.key}
            onPress={() => handleKeyPress(k)}
            activeOpacity={0.6}
          >
            <Text style={styles.keyText}>{k}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={styles.key}
          onPress={biometricAvailable ? handleBiometric : undefined}
          activeOpacity={0.6}
        >
          {biometricAvailable ? (
            <Ionicons name="finger-print-outline" size={28} color={c.accent} />
          ) : null}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.key}
          onPress={() => handleKeyPress('0')}
          activeOpacity={0.6}
        >
          <Text style={styles.keyText}>0</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.key}
          onPress={() => handleKeyPress('backspace')}
          activeOpacity={0.6}
        >
          <Ionicons name="backspace-outline" size={24} color={c.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function getStyles(c: ReturnType<typeof getColors>) {
  return StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: c.bg,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    zIndex: 999,
    elevation: 999,
  },
  top: {
    alignItems: 'center',
    marginBottom: 48,
  },
  lockCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: c.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    color: c.text,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  subtitle: {
    color: c.textSubtle,
    fontSize: 15,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 32,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  error: {
    color: c.destructive,
    fontSize: 14,
    marginBottom: 24,
  },
  lockout: {
    color: c.destructive,
    fontSize: 14,
    marginBottom: 24,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    maxWidth: 280,
  },
  key: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: c.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: c.borderLight,
  },
  keyText: {
    color: c.text,
    fontSize: 28,
    fontWeight: '500',
  },
  });
}
