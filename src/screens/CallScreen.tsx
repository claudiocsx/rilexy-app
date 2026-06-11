import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, NativeModules } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../contexts/AuthContext';
import { WebRTCService } from '../services/webrtc';
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

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function CallScreen() {
  const route = useRoute<CallRoute>();
  const { peerId, peerName, audioOnly } = route.params;
  const { user } = useAuth();
  const webrtcRef = useRef<WebRTCService | null>(null);

  const [status, setStatus] = useState<'connecting' | 'ringing' | 'connected' | 'ended'>('connecting');
  const [muted, setMuted] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(!audioOnly);
  const [duration, setDuration] = useState(0);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [rtcViewComp, setRtcViewComp] = useState<any>(null);
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
      } catch (e) {
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

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleToggleMute = () => {
    const w = webrtcRef.current;
    if (w) setMuted(!w.toggleMute());
  };

  const handleToggleVideo = () => {
    const w = webrtcRef.current;
    if (w && !audioOnly) setVideoEnabled(w.toggleVideo());
  };

  const handleSwitchCamera = () => {
    webrtcRef.current?.switchCamera();
  };

  const handleHangUp = () => {
    stopTimer();
    setStatus('ended');
    webrtcRef.current?.hangUp();
  };

  const localStream = webrtcRef.current?.getLocalStream();
  const RCTView = rtcViewComp;

  return (
    <View style={styles.container}>
      {status === 'ended' ? (
        <View style={styles.endedContainer}>
          <View style={styles.avatarLarge}>
            <Ionicons name="person" size={48} color={colors.text} />
          </View>
          <Text style={styles.endedName}>{peerName}</Text>
          <Text style={styles.endedText}>Chamada encerrada</Text>
          <Text style={styles.endedDuration}>
            {duration > 0 ? `Duração: ${formatDuration(duration)}` : ''}
          </Text>
        </View>
      ) : (
        <>
          {!audioOnly ? (
            <>
              <View style={styles.remoteVideoContainer}>
                {remoteStream && RCTView ? (
                  <RCTView
                    streamURL={remoteStream.toURL?.() || ''}
                    style={styles.remoteVideo}
                    objectFit="cover"
                  />
                ) : (
                  <View style={styles.remoteFallback}>
                    <View style={styles.avatarLarge}>
                      <Ionicons name="person" size={64} color={colors.text} />
                    </View>
                    <Text style={styles.peerName}>{peerName}</Text>
                    <Text style={styles.callStatus}>
                      {status === 'ringing' ? 'Chamando...' : 'Conectando...'}
                    </Text>
                  </View>
                )}
              </View>
              {localStream && RCTView && (
                <View style={styles.localVideoContainer}>
                  <RCTView
                    streamURL={localStream.toURL?.() || ''}
                    style={styles.localVideo}
                    objectFit="cover"
                  />
                </View>
              )}
            </>
          ) : (
            <View style={styles.voiceContainer}>
              <View style={styles.avatarExtraLarge}>
                <Ionicons name="person" size={72} color={colors.text} />
              </View>
              <Text style={styles.peerName}>{peerName}</Text>
              <Text style={styles.callStatus}>
                {status === 'connected'
                  ? formatDuration(duration)
                  : status === 'ringing'
                  ? 'Chamando...'
                  : 'Conectando...'}
              </Text>
            </View>
          )}

          <View style={styles.controls}>
            <TouchableOpacity
              style={[styles.controlButton, muted && styles.controlButtonActive]}
              onPress={handleToggleMute}
            >
              <Ionicons
                name={muted ? 'mic-off' : 'mic'}
                size={28}
                color={colors.text}
              />
            </TouchableOpacity>

            {!audioOnly && (
              <TouchableOpacity
                style={[styles.controlButton, !videoEnabled && styles.controlButtonActive]}
                onPress={handleToggleVideo}
              >
                <Ionicons
                  name={videoEnabled ? 'videocam' : 'videocam-off'}
                  size={28}
                  color={colors.text}
                />
              </TouchableOpacity>
            )}

            {!audioOnly && (
              <TouchableOpacity style={styles.controlButton} onPress={handleSwitchCamera}>
                <Ionicons name="camera-reverse" size={28} color={colors.text} />
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.hangupButton} onPress={handleHangUp}>
              <Ionicons name="call" size={32} color={colors.white} />
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  remoteVideoContainer: {
    flex: 1,
  },
  remoteVideo: {
    flex: 1,
  },
  remoteFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.elevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarExtraLarge: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.elevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  peerName: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 8,
  },
  callStatus: {
    color: colors.textMuted,
    fontSize: 16,
  },
  localVideoContainer: {
    position: 'absolute',
    top: 60,
    right: 16,
    width: 120,
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.borderLight,
  },
  localVideo: {
    flex: 1,
  },
  voiceContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    paddingVertical: 40,
    paddingBottom: 60,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonActive: {
    backgroundColor: colors.destructive,
  },
  hangupButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.destructive,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '135deg' }],
  },
  endedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  endedName: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 8,
  },
  endedText: {
    color: colors.textMuted,
    fontSize: 16,
    marginBottom: 4,
  },
  endedDuration: {
    color: colors.textSubtle,
    fontSize: 14,
  },
});
