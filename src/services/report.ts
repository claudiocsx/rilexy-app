import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

export interface Report {
  id?: string;
  postId: string;
  postSenderId: string;
  postText?: string;
  postMediaUrl?: string;
  reportedBy: string;
  reportedByName: string;
  reason: string;
  createdAt: firebase.firestore.FieldValue;
  status: 'pending' | 'reviewed' | 'dismissed';
}

export const REPORT_REASONS = [
  { key: 'spam', label: 'Spam ou publicidade não autorizada' },
  { key: 'inappropriate', label: 'Conteúdo sexual ou violento' },
  { key: 'harassment', label: 'Assédio ou bullying' },
  { key: 'misinformation', label: 'Desinformação ou fake news' },
  { key: 'copyright', label: 'Violação de direitos autorais' },
  { key: 'other', label: 'Outro motivo' },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]['key'];

export const reportPost = async (
  postId: string,
  postSenderId: string,
  reportedBy: string,
  reportedByName: string,
  reason: string,
  postText?: string,
  postMediaUrl?: string,
): Promise<void> => {
  const existing = await firebase.firestore()
    .collection('reports')
    .where('postId', '==', postId)
    .where('reportedBy', '==', reportedBy)
    .limit(1)
    .get();

  if (!existing.empty) {
    throw new Error('Você já reportou este post.');
  }

  await firebase.firestore().collection('reports').add({
    postId,
    postSenderId,
    postText: postText?.slice(0, 500) || '',
    postMediaUrl: postMediaUrl || '',
    reportedBy,
    reportedByName,
    reason,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    status: 'pending',
  });
};

export const getReports = async (): Promise<Report[]> => {
  const snap = await firebase.firestore()
    .collection('reports')
    .orderBy('createdAt', 'desc')
    .get();

  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Report));
};

export const dismissReport = async (reportId: string): Promise<void> => {
  await firebase.firestore().collection('reports').doc(reportId).update({
    status: 'dismissed',
  });
};

export const deletePostAndReport = async (reportId: string, postId: string): Promise<void> => {
  const batch = firebase.firestore().batch();

  batch.update(firebase.firestore().collection('reports').doc(reportId), {
    status: 'reviewed',
  });

  batch.delete(firebase.firestore().collection('posts').doc(postId));

  await batch.commit();
};
