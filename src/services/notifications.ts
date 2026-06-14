import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { db } from './firebase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(userId: string): Promise<string | null> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#a78bfa',
    });
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

  await db.collection('users').doc(userId).update({
    expoPushToken: token,
    pushTokenPlatform: Platform.OS,
  }).catch(() => {});

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
