import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { View, Text, StyleSheet, Animated, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getColors } from '../theme/colors';
import { useSettingsStore } from '../store/settingsStore';

type ToastType = 'success' | 'error' | 'info';

interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });

export const useToast = () => useContext(ToastContext);

let nextId = 0;

function ToastItem({ toast, onDone }: { toast: ToastMessage; onDone: () => void }) {
  const theme = useSettingsStore((s) => s.theme);
  const c = getColors(theme);
  const anim = useRef(new Animated.Value(0)).current;
  const topOffset = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 50;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 15,
      stiffness: 200,
    }).start();
    const timer = setTimeout(() => {
      Animated.timing(anim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => onDone());
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const iconMap: Record<ToastType, string> = {
    success: 'checkmark-circle',
    error: 'alert-circle',
    info: 'information-circle',
  };

  const bgMap: Record<ToastType, string> = {
    success: c.accent,
    error: c.destructive,
    info: c.accentDark,
  };

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          backgroundColor: bgMap[toast.type],
          top: topOffset,
          transform: [{
            translateY: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [-80, 0],
            }),
          }],
          opacity: anim,
        },
      ]}
    >
      <Ionicons name={iconMap[toast.type]} size={20} color={c.white} />
      <Text style={[styles.toastText, { color: c.white }]}>{toast.message}</Text>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    setToasts((prev) => [...prev, { id: nextId++, message, type }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDone={() => removeToast(t.id)} />
      ))}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    zIndex: 9999,
    elevation: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  toastText: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
});
