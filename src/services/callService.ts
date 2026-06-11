import { Alert } from 'react-native';
import { db } from './firebase';

type IncomingCallHandler = (data: { callerId: string; audioOnly: boolean; callerName?: string }) => void;

class CallService {
  private static unsub: (() => void) | null = null;

  static startListening(userId: string, onIncomingCall: IncomingCallHandler) {
    this.stopListening();
    this.unsub = db.collection('calls').doc(userId)
      .onSnapshot((snap: any) => {
        const data = snap.data();
        if (data?.callerId && data?.offer && !data?.answer && data.callerId !== userId) {
          const callerName = data.callerName || '';
          onIncomingCall({ callerId: data.callerId, audioOnly: data.audioOnly ?? false, callerName });
        }
      });
  }

  static stopListening() {
    this.unsub?.();
    this.unsub = null;
  }
}

export default CallService;
