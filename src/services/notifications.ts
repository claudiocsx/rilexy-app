import { Platform, Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';
import { db } from './firebase';
import firebase from './firebase';

export const currentUserIdRef: { current: string | null } = { current: null };

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data || {};
    if (data.currentUserId && currentUserIdRef.current === data.currentUserId) {
      return {
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      };
    }
    Vibration.vibrate([0, 250, 250, 250]);
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
});

export async function sendFcmPush(
  recipientUid: string,
  title: string,
  body: string,
  data?: Record<string, string>,
  channelId?: string,
  imageUrl?: string,
  categoryId?: string,
): Promise<void> {
  try {
    const recipientDoc = await db.collection('users').doc(recipientUid).get();
    const token = recipientDoc.data()?.expoPushToken;
    if (!token) return;

    const pushUrl = process.env.EXPO_PUBLIC_PUSH_URL || 'https://rilexy-api.vercel.app/send-push';
    const apiKey = process.env.EXPO_PUBLIC_PUSH_API_KEY || '';

    await fetch(pushUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        token,
        title,
        body,
        channelId,
        imageUrl,
        categoryId,
        data,
      }),
    });
  } catch {
    // Silently fails — notification is best-effort
  }
}

const CHANNELS = [
  { id: 'default', name: 'Geral' },
  { id: 'messages', name: 'Mensagens' },
  { id: 'posts', name: 'Publicações' },
  { id: 'calls', name: 'Chamadas' },
] as const;

export async function registerForPushNotifications(userId: string): Promise<string | null> {
  if (Platform.OS === 'android') {
    for (const ch of CHANNELS) {
      await Notifications.setNotificationChannelAsync(ch.id, {
        name: ch.name,
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#a78bfa',
      }).catch(() => {});
    }
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  const tokenData = await Notifications.getExpoPushTokenAsync();
  const token = tokenData.data;

  const updateData: Record<string, any> = {
    expoPushToken: token,
    pushTokenPlatform: Platform.OS,
  };

  // Try to capture native FCM token (works in dev builds, fails gracefully in Expo Go)
  try {
    const messaging = firebase.messaging();
    const fcmToken = await messaging.getToken();
    updateData.fcmToken = fcmToken;
  } catch {}

  await db.collection('users').doc(userId).update(updateData).catch(() => {});

  return token;
}

export async function unregisterPushNotifications(userId: string): Promise<void> {
  await db.collection('users').doc(userId).update({
    expoPushToken: null,
    pushTokenPlatform: null,
  }).catch(() => {});
}

export function addNotificationResponseListener(handler: (response: Notifications.NotificationResponse) => void) {
  const subscription = Notifications.addNotificationResponseReceivedListener(handler);
  return () => subscription.remove();
}

export function getLastNotificationResponse() {
  return Notifications.getLastNotificationResponseAsync();
}
