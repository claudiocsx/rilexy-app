import { useRef, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing, Dimensions, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getColors } from '../../theme/colors';
import { useSettingsStore } from '../../store/settingsStore';

interface IncomingCallViewProps {
  peerName: string;
  audioOnly: boolean;
  onAccept: () => void;
  onDecline: () => void;
  localStream?: any;
  RTCView?: any;
}

const SCREEN = Dimensions.get('window');

export default function IncomingCallView({ peerName, audioOnly, onAccept, onDecline, localStream, RTCView }: IncomingCallViewProps) {
  const theme = useSettingsStore((s) => s.theme);
  const c = getColors(theme);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const localUrl = localStream?.toURL?.() || '';
  const isVideoCall = !audioOnly;

  const s = useMemo(() => ({
    container: {
      flex: 1,
      backgroundColor: '#000',
    } as const,
    cameraBg: {
      ...StyleSheet.absoluteFillObject,
    } as const,
    cameraVideo: {
      flex: 1,
      backgroundColor: '#000',
    } as const,
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.35)',
      justifyContent: 'space-between' as const,
      paddingTop: 80,
      paddingBottom: 60,
    },
    content: {
      alignItems: 'center' as const,
      flex: 1,
      justifyContent: 'center' as const,
    },
    avatarRing: {
      width: 120,
      height: 120,
      borderRadius: 60,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      marginBottom: 20,
    } as const,
    avatarBg: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    },
    title: {
      color: 'rgba(255,255,255,0.6)',
      fontSize: 16,
      marginBottom: 8,
    },
    name: {
      color: '#fff',
      fontSize: 28,
      fontWeight: '700' as const,
      marginBottom: 8,
    },
    callType: {
      color: 'rgba(255,255,255,0.7)',
      fontSize: 15,
    },
    buttonsRow: {
      flexDirection: 'row' as const,
      justifyContent: 'space-around' as const,
      alignItems: 'center' as const,
      paddingHorizontal: 48,
    },
    declineBtn: {
      alignItems: 'center' as const,
    },
    declineCircle: {
      width: 68,
      height: 68,
      borderRadius: 34,
      backgroundColor: '#E11D48',
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      shadowColor: '#E11D48',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 8,
      marginBottom: 8,
    },
    acceptBtn: {
      alignItems: 'center' as const,
    },
    acceptCircle: {
      width: 68,
      height: 68,
      borderRadius: 34,
      backgroundColor: '#22C55E',
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      shadowColor: '#22C55E',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 8,
      marginBottom: 8,
    },
    btnLabel: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '500' as const,
    },
  }), []);

  const renderContent = () => (
    <>
      <View style={s.overlay}>
        <View style={s.content}>
          {!isVideoCall && (
            <Animated.View style={[s.avatarRing, { transform: [{ scale: pulseAnim }] }]}>
              <View style={s.avatarBg}>
                <Ionicons name="person" size={64} color="#fff" />
              </View>
            </Animated.View>
          )}

          <Text style={s.title}>Chamada {isVideoCall ? 'de vídeo' : 'de áudio'} recebida</Text>
          <Text style={s.name}>{peerName}</Text>
          <Text style={[s.callType]}>
            <Ionicons name={isVideoCall ? 'videocam' : 'call'} size={14} color="rgba(255,255,255,0.7)" />
            {' '}{isVideoCall ? 'Toque para atender' : 'Chamada de áudio'}
          </Text>
        </View>

        <View style={s.buttonsRow}>
          <TouchableOpacity
            accessibilityLabel="Recusar chamada"
            style={s.declineBtn}
            onPress={onDecline}
            activeOpacity={0.7}
          >
            <View style={s.declineCircle}>
              <Ionicons name="call-outline" size={32} color="#fff" />
            </View>
            <Text style={s.btnLabel}>Recusar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityLabel="Aceitar chamada"
            style={s.acceptBtn}
            onPress={onAccept}
            activeOpacity={0.7}
          >
            <View style={s.acceptCircle}>
              <Ionicons name="call" size={32} color="#fff" />
            </View>
            <Text style={s.btnLabel}>Atender</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );

  if (isVideoCall && localUrl && RTCView) {
    return (
      <View style={s.container}>
        <RTCView
          streamURL={localUrl}
          style={s.cameraVideo}
          objectFit="cover"
          mirror={true}
          zOrder={1}
        />
        {renderContent()}
      </View>
    );
  }

  return (
    <View style={s.container}>
      {renderContent()}
    </View>
  );
}

