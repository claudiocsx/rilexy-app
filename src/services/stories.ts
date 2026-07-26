import { db } from './firebase';
import firebase from 'firebase/compat/app';
import { uploadStoryMedia } from './storage';

const STORIES_COLLECTION = 'stories';

export interface Story {
  id: string;
  userId: string;
  userName: string;
  photoURL?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  text?: string;
  bgColor?: string;
  createdAt: firebase.firestore.Timestamp;
  expiresAt: firebase.firestore.Timestamp;
  viewedBy: string[];
  videoSegmentStart?: number;
  videoSegmentEnd?: number;
}

export interface StoryGroup {
  userId: string;
  userName: string;
  photoURL?: string;
  stories: Story[];
  allViewed: boolean;
}

export async function postStory(
  userId: string,
  userName: string,
  options: {
    mediaUri?: string;
    mediaType?: 'image' | 'video';
    text?: string;
    bgColor?: string;
    videoSegmentStart?: number;
    videoSegmentEnd?: number;
    mediaUrlOverride?: string;
  }
): Promise<string | null> {
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const docRef = await db.collection(STORIES_COLLECTION).add({
      userId,
      userName,
      createdAt: firebase.firestore.Timestamp.fromDate(now),
      expiresAt: firebase.firestore.Timestamp.fromDate(expiresAt),
      viewedBy: [],
      mediaUrl: '',
      mediaType: options.mediaType || null,
      text: options.text || '',
      bgColor: options.bgColor || null,
      videoSegmentStart: options.videoSegmentStart ?? null,
      videoSegmentEnd: options.videoSegmentEnd ?? null,
    });

    if (options.mediaUrlOverride) {
      await docRef.update({ mediaUrl: options.mediaUrlOverride });
    } else if (options.mediaUri) {
      const publicUrl = await uploadStoryMedia(userId, docRef.id, options.mediaUri);
      if (publicUrl) {
        await docRef.update({ mediaUrl: publicUrl });
      }
    }

    return docRef.id;
  } catch (error) {
    console.error('postStory error:', error);
    return null;
  }
}

export function observeStories(
  callback: (groups: StoryGroup[]) => void,
  onError?: (err: any) => void
): () => void {
  const now = new Date();

  const photoCache: Record<string, string | undefined> = {};

  return db.collection(STORIES_COLLECTION)
    .where('expiresAt', '>=', now)
    .orderBy('expiresAt', 'asc')
    .onSnapshot(async (snapshot) => {
      const allStories = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Story[];

      const userIds = [...new Set(allStories.map((s) => s.userId))];
      const missing = userIds.filter((id) => !(id in photoCache));
      if (missing.length > 0) {
        const results = await Promise.allSettled(
          missing.map((id) => db.collection('users').doc(id).get())
        );
        results.forEach((r, i) => {
          if (r.status === 'fulfilled') {
            photoCache[missing[i]] = r.value.data()?.photoURL || undefined;
          } else {
            photoCache[missing[i]] = undefined;
          }
        });
      }

      const grouped: Record<string, StoryGroup> = {};
      for (const story of allStories) {
        if (!grouped[story.userId]) {
          grouped[story.userId] = {
            userId: story.userId,
            userName: story.userName,
            photoURL: photoCache[story.userId],
            stories: [],
            allViewed: true,
          };
        }
        grouped[story.userId].stories.push(story);
      }

      const groups = Object.values(grouped);
      callback(groups);
    }, onError);
}

export function observeMyStory(
  userId: string,
  callback: (stories: Story[]) => void,
  onError?: (err: any) => void
): () => void {
  const now = new Date();

  return db.collection(STORIES_COLLECTION)
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .onSnapshot((snapshot) => {
      const allStories = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Story[];
      const valid = allStories.filter((s) => s.expiresAt?.toDate() > now);
      callback(valid);
    }, onError);
}

export async function markViewed(storyId: string, userId: string): Promise<void> {
  await db.collection(STORIES_COLLECTION).doc(storyId).update({
    viewedBy: firebase.firestore.FieldValue.arrayUnion(userId),
  });
}

export async function deleteStory(storyId: string): Promise<void> {
  await db.collection(STORIES_COLLECTION).doc(storyId).delete();
}
