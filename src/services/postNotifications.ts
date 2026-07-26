import { Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';
import { db } from './firebase';

let unsubscribe: (() => void) | null = null;
let isFirstSnapshot = true;

const notifiedLikes = new Map<string, Set<string>>();
const notifiedComments = new Map<string, number>();

export function startPostNotifications(userId: string) {
  stopPostNotifications();
  isFirstSnapshot = true;

  let prevLikedBy = new Map<string, string[]>();
  let prevCommentsCount = new Map<string, number>();

  const query = db.collection('posts').where('senderId', '==', userId);

  unsubscribe = query.onSnapshot(async (snapshot) => {
    if (isFirstSnapshot) {
      for (const doc of snapshot.docs) {
        const data = doc.data();
        prevLikedBy.set(doc.id, data.likedBy || []);
        prevCommentsCount.set(doc.id, data.commentsCount || 0);
      }
      isFirstSnapshot = false;
      return;
    }

    for (const change of snapshot.docChanges()) {
      if (change.type !== 'modified' && change.type !== 'added') continue;

      const data = change.doc.data();
      const postId = change.doc.id;
      const likedBy: string[] = data.likedBy || [];
      const commentsCount: number = data.commentsCount || 0;

      const oldLikedBy = prevLikedBy.get(postId) || [];
      const oldCommentsCount = prevCommentsCount.get(postId) || 0;

      prevLikedBy.set(postId, likedBy);
      prevCommentsCount.set(postId, commentsCount);

      const newLikers = likedBy.filter((uid) => !oldLikedBy.includes(uid) && uid !== userId);
      for (const likerId of newLikers) {
        const key = `${postId}_like_${likerId}`;
        const notified = notifiedLikes.get(postId);
        if (notified?.has(likerId)) continue;
        if (!notified) notifiedLikes.set(postId, new Set());
        notifiedLikes.get(postId)!.add(likerId);

        let name = 'Alguém';
        try {
          const doc = await db.collection('users').doc(likerId).get();
          if (doc.exists) name = doc.data()?.displayName || 'Alguém';
        } catch {}
        showNotification('Nova curtida', `${name} curtiu seu post`);
      }

      if (commentsCount > oldCommentsCount) {
        const notified = notifiedComments.get(postId) || 0;
        if (commentsCount <= notified) continue;
        notifiedComments.set(postId, commentsCount);

        try {
          const commentsSnap = await db.collection('posts').doc(postId)
            .collection('comments')
            .orderBy('timestamp', 'desc')
            .limit(1)
            .get();
          const lastComment = commentsSnap.docs[0]?.data();
          const commenterId = lastComment?.senderId;
          if (commenterId && commenterId !== userId) {
            let name = 'Alguém';
            try {
              const doc = await db.collection('users').doc(commenterId).get();
              if (doc.exists) name = doc.data()?.displayName || 'Alguém';
            } catch {}
            showNotification('Novo comentário', `${name} comentou no seu post`);
          }
        } catch {}
      }
    }
  }, (err) => {
    console.error('postNotifications listener error:', err.code, err.message);
  });
}

function showNotification(title: string, body: string) {
  Vibration.vibrate([0, 250, 250, 250]);
  Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.HIGH,
      channelId: 'posts',
      categoryIdentifier: 'post',
      data: { type: 'post', _fromLocal: true },
    } as any,
    trigger: null,
  }).catch(() => {});
}

export function stopPostNotifications() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  notifiedLikes.clear();
  notifiedComments.clear();
  isFirstSnapshot = true;
}
