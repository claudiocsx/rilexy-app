import { NativeModules } from 'react-native';
import { db } from './firebase';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
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
  private unsubscribers: (() => void)[] = [];
  private currentUserId: string;
  private peerUserId: string;
  private audioOnly: boolean;

  constructor(currentUserId: string, peerUserId: string, audioOnly = false) {
    this.currentUserId = currentUserId;
    this.peerUserId = peerUserId;
    this.audioOnly = audioOnly;
  }

  async startLocalStream(): Promise<any> {
    const { mediaDevices } = await getWebRTC();
    this.localStream = await mediaDevices.getUserMedia({
      video: !this.audioOnly,
      audio: true,
    });
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
    const { RTCSessionDescription } = await getWebRTC();
    await this.addLocalTracks();
    const pc = await this.ensurePC();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await db.collection('calls').doc(this.peerUserId).set({
      callerId: this.currentUserId,
      offer: { sdp: offer.sdp, type: offer.type },
      audioOnly: this.audioOnly,
      status: 'calling',
      timestamp: new Date(),
    });
  }

  async answerCall(): Promise<void> {
    const { RTCSessionDescription } = await getWebRTC();
    await this.addLocalTracks();
    const callSnap = await db.collection('calls').doc(this.currentUserId).get();
    const callData = callSnap.data();
    if (!callData?.offer) throw new Error('Nenhuma chamada encontrada');
    const pc = await this.ensurePC();
    await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));
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
        const data = snap.data();
        if (data?.answer && data.status === 'answered') {
          const { RTCSessionDescription } = await getWebRTC();
          const pc = await this.ensurePC();
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          onAnswered();
        }
      });
    this.unsubscribers.push(unsub);
    return unsub;
  }

  listenForIceCandidates(): () => void {
    const unsub = db.collection('calls').doc(this.currentUserId)
      .collection('iceCandidates')
      .onSnapshot(async (snapshot: any) => {
        const { RTCIceCandidate } = await getWebRTC();
        for (const change of snapshot.docChanges()) {
          if (change.type === 'added') {
            const data = change.doc.data();
            if (data.from !== this.currentUserId) {
              const pc = await this.ensurePC();
              try { pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch {}
            }
          }
        }
      });
    this.unsubscribers.push(unsub);
    return unsub;
  }

  onRemoteStream(callback: (stream: any) => void) {
    this.onRemoteStreamCallback = callback;
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
    this.pc?.close();
    this.localStream?.getTracks().forEach((t: any) => t.stop());
    this.unsubscribers.forEach(u => u());
    this.unsubscribers = [];
    this.pc = null;
    this.localStream = null;
    this.remoteStream = null;
    db.collection('calls').doc(this.currentUserId).delete().catch(() => {});
  }
}
