import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../contexts/AuthContext';
import { WebRTCService } from '../services/webrtc';
import CallControls from '../components/call/CallControls';
import VideoView from '../components/call/VideoView';
import VoiceView from '../components/call/VoiceView';
import CallStatusBar from '../components/call/CallStatusBar';
import EndedCallView from '../components/call/EndedCallView';
import { getColors } from '../theme/colors';
import { useSettingsStore } from '../store/settingsStore';
import { setAudioModeAsync } from 'expo-audio';
import * as Notifications from 'expo-notifications';
import { playRingtone, stopRingtone } from '../services/ringtone';
import CallService from '../services/callService';
import IncomingCallView from '../components/call/IncomingCallView';
import { saveCallRecord } from '../services/callHistory';

type CallRoute = RouteProp<RootStackParamList, 'Call'>;

let RTCView: any = null;
let rtcViewLoaded = false;
async function getRTCView() {
  if (!rtcViewLoaded) {
    rtcViewLoaded = true;
    try {
      const mod = await import('react-native-' + 'webrtc');
      RTCView = mod.RTCView || null;
    } catch {
      RTCView = null;
    }
  }
  return RTCView;
}

export default function CallScreen() {
  const theme = useSettingsStore((s) => s.theme);
  const c = getColors(theme);
  const styles = useMemo(() => getStyles(c), [c]);
  const route = useRoute<CallRoute>();
  const navigation = useNavigation();
  const { peerId, peerName, audioOnly, isIncoming } = route.params;
  const { user } = useAuth();
  const webrtcRef = useRef<WebRTCService | null>(null);

  const [status, setStatus] = useState<'connecting' | 'ringing' | 'connected' | 'ended'>('connecting');
  const [muted, setMuted] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(!audioOnly);
  const [speakerOn, setSpeakerOn] = useState(false);
  const [duration, setDuration] = useState(0);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [rtcViewComp, setRtcViewComp] = useState<any>(null);
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor' | 'unknown'>('unknown');
  const [endReason, setEndReason] = useState('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const callStartedRef = useRef(false);
  const callAnsweredRef = useRef(false);
  const callDurationRef = useRef(0);
  const callSavedRef = useRef(false);
  const incomingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callNotifIdRef = useRef<string | null>(null);

  useEffect(() => {
    getRTCView().then(setRtcViewComp);
  }, []);

  useEffect(() => {
    if (!user) return;

    const run = async () => {
      const w = new WebRTCService(user.uid, peerId, audioOnly, user.displayName || '', user.photoURL || '');
      webrtcRef.current = w;

      w.onRemoteStream((stream) => {
        setRemoteStream(stream);
      });

      w.onRemoteHangUp(() => {
        stopRingtone();
        stopTimer();
        setEndReason('A pessoa desligou');
        setStatus('ended');
        if (!callSavedRef.current) {
          callSavedRef.current = true;
          saveCallRecord({
            peerId,
            peerName,
            type: audioOnly ? 'audio' : 'video',
            direction: isIncoming ? 'incoming' : 'outgoing',
            status: callAnsweredRef.current ? 'answered' : 'missed',
            duration: callDurationRef.current,
            uid: user.uid,
          }).catch(() => {});
        }
        webrtcRef.current?.hangUp();
      });

      // Listen for remote end via Firestore
      w.listenForRemoteEnd();

      try {
        await w.startLocalStream();
        w.listenForIceCandidates();
        if (isIncoming) {
          setStatus('ringing');
          callStartedRef.current = true;
          incomingTimeoutRef.current = setTimeout(() => {
            handleDecline();
          }, 45000);
        } else {
          const answerTimeout = setTimeout(() => {
            w.hangUp();
            setEndReason('A pessoa não atendeu');
            setStatus('ended');
            if (!callSavedRef.current) {
              callSavedRef.current = true;
              saveCallRecord({
                peerId,
                peerName,
                type: audioOnly ? 'audio' : 'video',
                direction: 'outgoing',
                status: 'missed',
                duration: 0,
                uid: user.uid,
              }).catch(() => {});
            }
          }, 45000);
          w.listenForAnswer(() => {
            clearTimeout(answerTimeout);
            callAnsweredRef.current = true;
            setStatus('connected');
            startTimer();
          });
          callStartedRef.current = true;
          await w.startCall();
          setStatus('ringing');
        }
      } catch (e: any) {
        webrtcRef.current?.hangUp();
        const msg = e?.message || '';
        if (msg.includes('Timeout')) {
          setEndReason('Não foi possível acessar a câmera/microfone');
        } else if (msg.includes('permission') || msg.includes('Permission')) {
          setEndReason('Permissão de câmera/microfone negada');
        } else if (msg.includes('network') || msg.includes('Network')) {
          setEndReason('Erro de conexão');
        } else {
          setEndReason('Erro ao iniciar chamada');
        }
        setStatus('ended');
      }
    };

    run().catch(() => {});

    return () => {
      if (incomingTimeoutRef.current) {
        clearTimeout(incomingTimeoutRef.current);
      }
      cancelCallNotification();
      stopRingtone();
      stopTimer();
      webrtcRef.current?.hangUp();
      webrtcRef.current = null;
    };
  }, [user]);

  useEffect(() => {
    if (status === 'ringing') { playRingtone(); }
    else { stopRingtone(); }
  }, [status]);

  useEffect(() => {
    if (status !== 'connected') return;
    const interval = setInterval(() => {
      const pc = (webrtcRef.current as any)?.pc;
      if (!pc) return;
      const state = pc?.iceConnectionState;
      if (state === 'connected' || state === 'completed') {
        setConnectionQuality('excellent');
      } else if (state === 'checking') {
        setConnectionQuality('good');
      } else {
        setConnectionQuality('poor');
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    if (status === 'connected') {
      showCallNotification();
      const notifInterval = setInterval(showCallNotification, 30000);
      return () => clearInterval(notifInterval);
    }
    if (status === 'ended') {
      cancelCallNotification();
    }
  }, [status]);

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => {
      setDuration((d) => {
        const next = d + 1;
        callDurationRef.current = next;
        return next;
      });
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  function formatDuration(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  async function showCallNotification() {
    if (callNotifIdRef.current) {
      await Notifications.cancelScheduledNotificationAsync(callNotifIdRef.current);
    }
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '📞 Chamada em andamento',
        body: `${peerName} — ${formatDuration(callDurationRef.current)}`,
        data: { type: 'ongoing_call', peerId } as any,
        channelId: 'calls',
        autoDismiss: false,
      } as any,
      trigger: null,
    });
    callNotifIdRef.current = id;
  }

  async function cancelCallNotification() {
    if (callNotifIdRef.current) {
      await Notifications.cancelScheduledNotificationAsync(callNotifIdRef.current);
      callNotifIdRef.current = null;
    }
  }

  const handleToggleMute = useCallback(() => {
    const w = webrtcRef.current;
    if (w) setMuted(!w.toggleMute());
  }, []);

  const handleToggleVideo = useCallback(() => {
    const w = webrtcRef.current;
    if (w && !audioOnly) setVideoEnabled(w.toggleVideo());
  }, [audioOnly]);

  const handleToggleSpeaker = useCallback(() => {
    setSpeakerOn((prev) => {
      const next = !prev;
      setAudioModeAsync({ shouldRouteThroughEarpiece: !next }).catch(() => {});
      return next;
    });
  }, []);

  const handleSwitchCamera = useCallback(() => {
    webrtcRef.current?.switchCamera();
  }, []);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  const handleAccept = useCallback(async () => {
    try {
      await webrtcRef.current?.answerCall();
      callAnsweredRef.current = true;
      setStatus('connected');
      startTimer();
    } catch {
      webrtcRef.current?.hangUp();
      setStatus('ended');
    }
  }, [startTimer]);

  const handleDecline = useCallback(() => {
    if (incomingTimeoutRef.current) {
      clearTimeout(incomingTimeoutRef.current);
      incomingTimeoutRef.current = null;
    }
    CallService.rejectCall(user!.uid, peerId);
    if (!callSavedRef.current) {
      callSavedRef.current = true;
      saveCallRecord({
        peerId,
        peerName,
        type: audioOnly ? 'audio' : 'video',
        direction: 'incoming',
        status: 'declined',
        duration: 0,
        uid: user!.uid,
      }).catch(() => {});
    }
    stopTimer();
    setStatus('ended');
    webrtcRef.current?.hangUp();
  }, [peerId, peerName, audioOnly, user, stopTimer]);

  const handleHangUp = useCallback(() => {
    stopTimer();
    setStatus('ended');
    if (callStartedRef.current && !callSavedRef.current) {
      callSavedRef.current = true;
      saveCallRecord({
        peerId,
        peerName,
        type: audioOnly ? 'audio' : 'video',
        direction: isIncoming ? 'incoming' : 'outgoing',
        status: callAnsweredRef.current ? 'answered' : 'missed',
        duration: callDurationRef.current,
        uid: user?.uid || '',
      }).catch(() => {});
    }
    webrtcRef.current?.hangUp();
  }, [stopTimer, peerId, peerName, audioOnly, isIncoming, user]);

  useEffect(() => {
    if (status !== 'ended') return;
    const timer = setTimeout(goBack, 4000);
    return () => clearTimeout(timer);
  }, [status, goBack]);

  if (isIncoming && status === 'ringing') {
    return (
      <IncomingCallView
        peerName={peerName}
        audioOnly={audioOnly}
        onAccept={handleAccept}
        onDecline={handleDecline}
        localStream={webrtcRef.current?.getLocalStream()}
        RTCView={rtcViewComp}
      />
    );
  }

  if (status === 'ended') {
    return <EndedCallView peerName={peerName} duration={duration} endReason={endReason} onClose={goBack} />;
  }

  return (
    <View style={styles.container}>
      <CallStatusBar
        duration={duration}
        connectionQuality={connectionQuality}
        status={status}
      />

      {audioOnly ? (
        <VoiceView
          peerName={peerName}
          status={status}
          duration={duration}
        />
      ) : (
        <VideoView
          remoteStream={remoteStream}
          localStream={webrtcRef.current?.getLocalStream()}
          RTCView={rtcViewComp}
          peerName={peerName}
          status={status}
        />
      )}

      <CallControls
        muted={muted}
        videoEnabled={videoEnabled}
        speakerOn={speakerOn}
        audioOnly={audioOnly}
        onToggleMute={handleToggleMute}
        onToggleVideo={handleToggleVideo}
        onToggleSpeaker={handleToggleSpeaker}
        onSwitchCamera={handleSwitchCamera}
        onHangUp={handleHangUp}
      />
    </View>
  );
}

function getStyles(c: ReturnType<typeof getColors>) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg,
  },
  });
}
