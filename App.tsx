import 'react-native-gesture-handler';
import { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { ToastProvider } from './src/components/Toast';
import AppNavigator, { navigationRef } from './src/navigation/AppNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import { setupPresence } from './src/services/presence';
import { registerForPushNotifications, addNotificationResponseListener, getLastNotificationResponse, currentUserIdRef } from './src/services/notifications';
import firebase from 'firebase/compat/app';
import { db } from './src/services/firebase';
import { startPostNotifications, stopPostNotifications } from './src/services/postNotifications';
import { startLocalChatNotifications, stopLocalChatNotifications } from './src/services/chatNotifications';
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
  const coldStartHandled = useRef(false);

  useEffect(() => {
    currentUserIdRef.current = user?.uid || null;
    if (user && !registered.current) {
      registered.current = true;
      registerForPushNotifications(user.uid).catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    const cleanup = addNotificationResponseListener(async (response) => {
      const d = response.notification.request.content.data || {};
      const action = response.actionIdentifier;

      if ((d.type === 'call' || d.type === 'call_audio' || d.type === 'call_video') && d.callerId) {
        if (action === 'DECLINE') {
          db.collection('calls').doc(d.recipientId as string).delete().catch(() => {});
        } else {
          navigationRef.current?.navigate('Call', {
            peerId: d.callerId as string,
            peerName: (d.callerName as string) || '...',
            audioOnly: d.audioOnly === true || d.audioOnly === 'true',
            isIncoming: true,
          });
        }
        return;
      }

      if (d.type === 'message') {
        if (action === 'REPLY' && response.userText && d.chatId && d.currentUserId) {
          const text = response.userText.trim();
          if (text) {
            const chatId = d.chatId as string;
            const uid = currentUserIdRef.current || (d.recipientId as string) || (d.currentUserId as string);
            const msgRef = db.collection('chats').doc(chatId).collection('messages').doc();
            msgRef.set({
              text,
              senderId: uid,
              timestamp: new Date(),
            }).catch(() => {});
            db.collection('chats').doc(chatId).update({
              lastMessage: text,
              lastMessageTime: new Date(),
              lastMessageSender: uid,
            }).catch(() => {});
            db.collection('chats').doc(chatId).get().then((doc) => {
              if (!doc.exists) return;
              const participants = doc.data()!.participants || [];
              const outros = participants.filter((p: string) => p !== uid);
              db.collection('users').doc(uid).get().then((userDoc) => {
                const senderName = userDoc.exists ? (userDoc.data()!.displayName || 'Você') : 'Você';
                msgRef.update({ participants, readBy: [uid], senderName }).catch(() => {});
              }).catch(() => {});
              if (outros.length > 0) {
                const updates: Record<string, any> = {};
                outros.forEach((p: string) => { updates[`unreadCount.${p}`] = firebase.firestore.FieldValue.increment(1); });
                db.collection('chats').doc(chatId).update(updates).catch(() => {});
              }
            }).catch(() => {});
          }
        }
        const name = (d.peerName as string) || '...';
        navigationRef.current?.navigate('Chat', { chatId: d.chatId as string, name });
        return;
      }

      if (d.type === 'post') {
        navigationRef.current?.navigate('Main', { screen: 'Feed' });
      }
    });
    return cleanup;
  }, []);

  useEffect(() => {
    if (!user || coldStartHandled.current) return;
    coldStartHandled.current = true;

    getLastNotificationResponse().then((response) => {
      if (!response) return;
      const d = response.notification.request.content.data || {};
      const action = response.actionIdentifier;

      const doNavigate = () => {
        if ((d.type === 'call' || d.type === 'call_audio' || d.type === 'call_video') && d.callerId && action !== 'DECLINE') {
          navigationRef.current?.navigate('Call', {
            peerId: d.callerId as string,
            peerName: (d.callerName as string) || '...',
            audioOnly: d.audioOnly === true || d.audioOnly === 'true',
            isIncoming: true,
          });
          return true;
        }
        if (d.type === 'message' && d.chatId) {
          navigationRef.current?.navigate('Chat', { chatId: d.chatId as string, name: (d.peerName as string) || '...' });
          return true;
        }
        return false;
      };

      if (!navigationRef.current) {
        const retry = setInterval(() => {
          if (navigationRef.current) {
            clearInterval(retry);
            doNavigate();
          }
        }, 200);
        setTimeout(() => clearInterval(retry), 10000);
      } else {
        doNavigate();
      }
    }).catch(() => {});
  }, [user]);

  return null;
}

function PostNotificationHandler() {
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      startPostNotifications(user.uid);
    } else {
      stopPostNotifications();
    }
    return () => stopPostNotifications();
  }, [user]);

  return null;
}

function ChatNotificationHandler() {
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      startLocalChatNotifications(user.uid);
    } else {
      stopLocalChatNotifications();
    }
    return () => stopLocalChatNotifications();
  }, [user]);

  return null;
}

function ThemeStatusBar() {
  const theme = useSettingsStore((s) => s.theme);
  return <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />;
}

function ScreenCaptureProtection() {
  useEffect(() => {
    (async () => {
      try {
        const { preventScreenCaptureAsync } = await import('expo-screen-capture');
        await preventScreenCaptureAsync();
      } catch {}
    })();
  }, []);
  return null;
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <AuthProvider>
          <ToastProvider>
            <ThemeStatusBar />
            <ScreenCaptureProtection />
            <PresenceHandler />
            <NotificationHandler />
            <ChatNotificationHandler />
            <PostNotificationHandler />
            <AppNavigator />
          </ToastProvider>
        </AuthProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
