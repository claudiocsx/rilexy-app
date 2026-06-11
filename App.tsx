import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { setupPresence } from './src/services/presence';

function PresenceHandler() {
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      setupPresence(user);
    }
  }, [user]);

  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <PresenceHandler />
      <AppNavigator />
    </AuthProvider>
  );
}
