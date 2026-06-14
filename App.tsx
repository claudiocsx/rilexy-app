import { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { setupPresence } from './src/services/presence';
import { registerForPushNotifications, addNotificationResponseListener } from './src/services/notifications';
import { useSettingsStore } from './src/store/settingsStore';
import { getColors } from './src/theme/colors';

function PresenceHandler() {
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      setupPresence(user);
    }
  }, [user]);

  return null;
}

function NotificationHandler() {
  const { user } = useAuth();
  const registered = useRef(false);

  useEffect(() => {
    if (user && !registered.current) {
      registered.current = true;
      registerForPushNotifications(user.uid).catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    const cleanup = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.chatId) {
        // Navigation would be handled by deep link
      }
    });
    return cleanup;
  }, []);

  return null;
}

function ThemeStatusBar() {
  const theme = useSettingsStore((s) => s.theme);
  return <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />;
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeStatusBar />
      <PresenceHandler />
      <NotificationHandler />
      <AppNavigator />
    </AuthProvider>
  );
}
