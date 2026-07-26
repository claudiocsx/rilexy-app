import { db } from './firebase';
import firebase from 'firebase/compat/app';

export interface CallRecord {
  id: string;
  peerId: string;
  peerName: string;
  type: 'audio' | 'video';
  direction: 'incoming' | 'outgoing';
  status: 'missed' | 'answered' | 'declined';
  duration: number;
  timestamp: Date;
}

function newId(): string {
  return db.collection('_').doc().id;
}

export async function saveCallRecord(data: {
  peerId: string;
  peerName: string;
  type: 'audio' | 'video';
  direction: 'incoming' | 'outgoing';
  status: 'missed' | 'answered' | 'declined';
  duration: number;
  uid: string;
}): Promise<void> {
  if (!data.uid) return;
  const id = newId();
  await db.collection('callHistory').doc(data.uid).collection('logs').doc(id).set({
    peerId: data.peerId,
    peerName: data.peerName,
    type: data.type,
    direction: data.direction,
    status: data.status,
    duration: data.duration,
    timestamp: firebase.firestore.Timestamp.now(),
  });
}

export function observeCallHistory(
  userId: string,
  limitCount: number,
  onData: (records: CallRecord[]) => void,
): () => void {
  const q = db.collection('callHistory').doc(userId).collection('logs')
    .orderBy('timestamp', 'desc')
    .limit(limitCount);

  return q.onSnapshot((snap) => {
    const list = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      timestamp: d.data().timestamp?.toDate?.() || new Date(),
    })) as CallRecord[];
    onData(list);
  }, () => onData([]));
}
