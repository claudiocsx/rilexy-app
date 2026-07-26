import { NativeModules } from 'react-native';
import { db } from './firebase';
import { sendFcmPush } from './notifications';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
};

type WebRTCTypes = {
  mediaDevices: any;
  MediaStream: any;
  RTCPeerConnection: any;
  RTCSessionDescription: any;
  RTCIceCandidate: any;
};

let webrtcModule: WebRTCTypes | null = null;

function isWebRTCAvailable(): boolean {
  return NativeModules?.WebRTCModule != null;
}

async function getWebRTC(): Promise<WebRTCTypes> {
  if (!isWebRTCAvailable()) {
    throw new Error('WebRTC não disponível. Use expo-dev-client.');
  }
  if (!webrtcModule) {
    webrtcModule = await import('react-native-' + 'webrtc');
  }
  return webrtcModule!;
}

export class WebRTCService {
  private pc: any = null;
  private localStream: any = null;
  private remoteStream: any = null;
  private onRemoteStreamCallback: ((stream: any) => void) | null = null;
  private onRemoteHangUpCallback: (() => void) | null = null;
  private onConnectionStateCallback: ((state: string) => void) | null = null;
  private unsubscribers: (() => void)[] = [];
  private currentUserId: string;
  private currentUserName: string;
  private currentUserPhoto: string;
  private peerUserId: string;
  private audioOnly: boolean;
  private disconnectedTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(currentUserId: string, peerUserId: string, audioOnly = false, currentUserName = '', currentUserPhoto = '') {
    this.currentUserId = currentUserId;
    this.currentUserName = currentUserName;
    this.currentUserPhoto = currentUserPhoto;
    this.peerUserId = peerUserId;
    this.audioOnly = audioOnly;
  }

  async startLocalStream(): Promise<any> {
    const { mediaDevices } = await getWebRTC();
    const stream = await Promise.race([
      mediaDevices.getUserMedia({
        video: !this.audioOnly,
        audio: true,
      }),
      new Promise<any>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout ao acessar câmera/microfone')), 15000)
      ),
    ]);
    this.localStream = stream;
    return this.localStream;
  }

  private async ensurePC(): Promise<any> {
    if (this.pc) return this.pc;
    const { RTCPeerConnection } = await getWebRTC();
    this.pc = new RTCPeerConnection(ICE_SERVERS);
    this.pc.addEventListener('track', (event: any) => {
      if (event.streams?.[0] && this.onRemoteStreamCallback) {
        this.remoteStream = event.streams[0];
        this.onRemoteStreamCallback(event.streams[0]);
      }
    });
    this.pc.addEventListener('iceconnectionstatechange', () => {
      const state = this.pc?.iceConnectionState;
      this.onConnectionStateCallback?.(state);
      if (state === 'disconnected') {
        if (!this.disconnectedTimer) {
          this.disconnectedTimer = setTimeout(() => {
            this.disconnectedTimer = null;
            this.onRemoteHangUpCallback?.();
          }, 15000);
        }
      } else if (state === 'failed') {
        this.clearDisconnectedTimer();
        this.onRemoteHangUpCallback?.();
      } else if (state === 'connected' || state === 'completed') {
        this.clearDisconnectedTimer();
      }
    });
    this.pc.addEventListener('icecandidate', (event: any) => {
      if (event.candidate) {
        db.collection('calls').doc(this.peerUserId)
          .collection('iceCandidates').add({
            candidate: event.candidate.toJSON(),
            from: this.currentUserId,
            timestamp: new Date(),
          });
      }
    });
    return this.pc;
  }

  private async addLocalTracks() {
    const pc = await this.ensurePC();
    if (this.localStream) {
      this.localStream.getTracks().forEach((track: any) => {
        pc.addTrack(track, this.localStream);
      });
    }
  }

  async startCall(): Promise<void> {
    try {
      const { RTCSessionDescription } = await getWebRTC();
      await this.addLocalTracks();
      const pc = await this.ensurePC();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await db.collection('calls').doc(this.peerUserId).set({
        callerId: this.currentUserId,
        callerName: this.currentUserName,
        offer: { sdp: offer.sdp, type: offer.type },
        audioOnly: this.audioOnly,
        status: 'calling',
        timestamp: new Date(),
      });
      sendFcmPush(
        this.peerUserId,
        this.currentUserName,
        this.audioOnly ? '🔊 Chamada de áudio' : '📹 Chamada de vídeo',
        { type: this.audioOnly ? 'call_audio' : 'call_video', callerId: this.currentUserId, callerName: this.currentUserName, audioOnly: this.audioOnly, currentUserId: this.currentUserId },
        'calls',
        this.currentUserPhoto || undefined,
        'incomingCall',
      );
    } catch (e) {
      this.hangUp();
      throw e;
    }
  }

  async answerCall(): Promise<void> {
    try {
      const { RTCSessionDescription } = await getWebRTC();
      await this.addLocalTracks();
      const callSnap = await db.collection('calls').doc(this.currentUserId).get();
      const callData = callSnap.data();
      if (!callData?.offer) throw new Error('Nenhuma chamada encontrada');
      const pc = await this.ensurePC();
      await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));
      this.remoteDescriptionSet = true;
      this.processIceCandidateQueue();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      const answerData = { sdp: answer.sdp, type: answer.type };
      await db.collection('calls').doc(this.currentUserId).update({
        answer: answerData,
        status: 'answered',
      });
      await db.collection('calls').doc(callData.callerId).set({
        answer: answerData,
        status: 'answered',
      }, { merge: true });
    } catch (e) {
      this.hangUp();
      throw e;
    }
  }

  listenForOffer(onOffer: (callerId: string, audioOnly: boolean) => void): () => void {
    const unsub = db.collection('calls').doc(this.currentUserId)
      .onSnapshot((snap: any) => {
        const data = snap.data();
        if (data?.offer && !data?.answer) {
          onOffer(data.callerId, data.audioOnly || false);
        }
      });
    this.unsubscribers.push(unsub);
    return unsub;
  }

  listenForAnswer(onAnswered: () => void): () => void {
    const unsub = db.collection('calls').doc(this.currentUserId)
      .onSnapshot(async (snap: any) => {
        try {
          const data = snap.data();
          if (data?.answer && data.status === 'answered') {
            const { RTCSessionDescription } = await getWebRTC();
            const pc = await this.ensurePC();
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            this.remoteDescriptionSet = true;
            this.processIceCandidateQueue();
            onAnswered();
          }
        } catch {}
      });
    this.unsubscribers.push(unsub);
    return unsub;
  }

  private iceCandidateQueue: any[] = [];
  private processingIceCandidates = false;
  private remoteDescriptionSet = false;

  private async processIceCandidateQueue() {
    if (this.processingIceCandidates || this.iceCandidateQueue.length === 0) return;
    if (!this.remoteDescriptionSet) return;
    try {
      const { RTCIceCandidate } = await getWebRTC();
      this.processingIceCandidates = true;
      try {
        while (this.iceCandidateQueue.length > 0) {
          const candidate = this.iceCandidateQueue.shift();
          const pc = await this.ensurePC();
          try {
            pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            this.iceCandidateQueue.unshift(candidate);
            break;
          }
          await new Promise(r => setTimeout(r, 50));
        }
      } finally {
        this.processingIceCandidates = false;
        if (this.iceCandidateQueue.length > 0) {
          this.processIceCandidateQueue();
        }
      }
    } catch {
      this.processingIceCandidates = false;
      if (this.iceCandidateQueue.length > 0) {
        this.processIceCandidateQueue();
      }
    }
  }

  listenForRemoteEnd(): () => void {
    const unsub = db.collection('calls').doc(this.currentUserId)
      .onSnapshot((snap: any) => {
        const data = snap.data();
        if (data?.status === 'ended' && data?.endedBy !== this.currentUserId) {
          this.onRemoteHangUpCallback?.();
        }
      });
    this.unsubscribers.push(unsub);
    return unsub;
  }

  listenForIceCandidates(): () => void {
    const unsub = db.collection('calls').doc(this.currentUserId)
      .collection('iceCandidates')
      .onSnapshot(async (snapshot: any) => {
        try {
          for (const change of snapshot.docChanges()) {
            if (change.type === 'added') {
              const data = change.doc.data();
              if (data.from !== this.currentUserId) {
                this.iceCandidateQueue.push(data.candidate);
              }
            }
          }
          this.processIceCandidateQueue();
        } catch {}
      });
    this.unsubscribers.push(unsub);
    return unsub;
  }

  onRemoteStream(callback: (stream: any) => void) {
    this.onRemoteStreamCallback = callback;
  }

  onRemoteHangUp(callback: () => void) {
    this.onRemoteHangUpCallback = callback;
  }

  onConnectionState(callback: (state: string) => void) {
    this.onConnectionStateCallback = callback;
  }

  private clearDisconnectedTimer() {
    if (this.disconnectedTimer) {
      clearTimeout(this.disconnectedTimer);
      this.disconnectedTimer = null;
    }
  }

  getLocalStream(): any { return this.localStream; }
  getRemoteStream(): any { return this.remoteStream; }

  toggleMute(): boolean {
    this.localStream?.getAudioTracks().forEach((t: any) => { t.enabled = !t.enabled; });
    return this.localStream?.getAudioTracks()[0]?.enabled ?? true;
  }

  toggleVideo(): boolean {
    if (this.audioOnly) return false;
    this.localStream?.getVideoTracks().forEach((t: any) => { t.enabled = !t.enabled; });
    return this.localStream?.getVideoTracks()[0]?.enabled ?? true;
  }

  switchCamera() {
    this.localStream?.getVideoTracks().forEach((t: any) => {
      if (typeof t._switchCamera === 'function') t._switchCamera();
    });
  }

  hangUp() {
    this.clearDisconnectedTimer();
    this.onConnectionStateCallback = null;
    db.collection('calls').doc(this.peerUserId).set({
      status: 'ended',
      endedBy: this.currentUserId,
      endedAt: new Date(),
    }).catch(() => {});
    try {
      this.pc?.close();
      this.localStream?.getTracks().forEach((t: any) => t.stop());
    } catch {}
    this.unsubscribers.forEach(u => u());
    this.unsubscribers = [];
    this.pc = null;
    this.localStream = null;
    this.remoteStream = null;
    db.collection('calls').doc(this.currentUserId).delete().catch(() => {});
  }
}
