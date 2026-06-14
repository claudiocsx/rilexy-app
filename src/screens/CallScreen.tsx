import { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, NativeModules } from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../contexts/AuthContext';
import { WebRTCService } from '../services/webrtc';
import CallControls from '../components/call/CallControls';
import VideoView from '../components/call/VideoView';
import VoiceView from '../components/call/VoiceView';
import CallStatusBar from '../components/call/CallStatusBar';
import EndedCallView from '../components/call/EndedCallView';
import { colors } from '../theme/colors';

type CallRoute = RouteProp<RootStackParamList, 'Call'>;

let RTCView: any = null;
let rtcViewLoaded = false;
async function getRTCView() {
  if (!rtcViewLoaded) {
    rtcViewLoaded = true;
    if (!NativeModules?.WebRTCModule) { return null; }
    try {
      const mod = await import('react-native-' + 'webrtc');
      RTCView = mod.RTCView;
    } catch {
      RTCView = null;
    }
  }
  return RTCView;
}

export default function CallScreen() {
  const route = useRoute<CallRoute>();
  const navigation = useNavigation();
  const { peerId, peerName, audioOnly } = route.params;
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
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    getRTCView().then(setRtcViewComp);
  }, []);

  useEffect(() => {
    if (!user) return;
    const w = new WebRTCService(user.uid, peerId, audioOnly);
    webrtcRef.current = w;

    w.onRemoteStream((stream) => {
      setRemoteStream(stream);
    });

    const setup = async () => {
      try {
        await w.startLocalStream();
        w.listenForAnswer(() => {
          setStatus('connected');
          startTimer();
        });
        w.listenForIceCandidates();
        await w.startCall();
        setStatus('ringing');
      } catch {
        setStatus('ended');
      }
    };

    setup();

    return () => {
      stopTimer();
      w.hangUp();
      webrtcRef.current = null;
    };
  }, []);

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

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleToggleMute = useCallback(() => {
    const w = webrtcRef.current;
    if (w) setMuted(!w.toggleMute());
  }, []);

  const handleToggleVideo = useCallback(() => {
    const w = webrtcRef.current;
    if (w && !audioOnly) setVideoEnabled(w.toggleVideo());
  }, [audioOnly]);

  const handleToggleSpeaker = useCallback(() => {
    setSpeakerOn((prev) => !prev);
  }, []);

  const handleSwitchCamera = useCallback(() => {
    webrtcRef.current?.switchCamera();
  }, []);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  const handleHangUp = useCallback(() => {
    stopTimer();
    setStatus('ended');
    webrtcRef.current?.hangUp();
  }, [stopTimer]);

  useEffect(() => {
    if (status !== 'ended') return;
    const timer = setTimeout(goBack, 4000);
    return () => clearTimeout(timer);
  }, [status, goBack]);

  if (status === 'ended') {
    return <EndedCallView peerName={peerName} duration={duration} onClose={goBack} />;
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
