import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { colors } from '../../theme/colors';

interface CallControlsProps {
  muted: boolean;
  videoEnabled: boolean;
  speakerOn: boolean;
  audioOnly: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleSpeaker: () => void;
  onSwitchCamera: () => void;
  onHangUp: () => void;
}

const BTN_SIZE = 56;
const HANDPUP_SIZE = 64;

function haptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export default function CallControls({
  muted, videoEnabled, speakerOn, audioOnly,
  onToggleMute, onToggleVideo, onToggleSpeaker, onSwitchCamera, onHangUp,
}: CallControlsProps) {
  return (
    <BlurView intensity={30} tint="dark" style={styles.container}>
      <View style={styles.row}>
        <ControlButton
          icon={muted ? 'mic-off' : 'mic'}
          label="Microfone"
          active={muted}
          onPress={() => { haptic(); onToggleMute(); }}
        />
        {!audioOnly && (
          <ControlButton
            icon={videoEnabled ? 'videocam' : 'videocam-off'}
            label="Câmera"
            active={!videoEnabled}
            onPress={() => { haptic(); onToggleVideo(); }}
          />
        )}
        <ControlButton
          icon={speakerOn ? 'volume-high' : 'volume-mute'}
          label="Alto-falante"
          active={speakerOn}
          onPress={() => { haptic(); onToggleSpeaker(); }}
        />
        {!audioOnly && (
          <ControlButton
            icon="camera-reverse"
            label="Virar"
            active={false}
            onPress={() => { haptic(); onSwitchCamera(); }}
          />
        )}
      </View>

      <TouchableOpacity
        style={styles.hangup}
        onPress={() => { haptic(); onHangUp(); }}
        activeOpacity={0.7}
      >
        <Ionicons name="call" size={32} color="#fff" />
      </TouchableOpacity>
    </BlurView>
  );
}

function ControlButton({ icon, label, active, onPress }: {
  icon: any; label: string; active: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.btn, active && styles.btnActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons name={icon} size={24} color={active ? '#fff' : colors.text} />
      <Text style={[styles.btnLabel, active && styles.btnLabelActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingBottom: 40,
    paddingTop: 20,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 24,
  },
  btn: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: BTN_SIZE / 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  btnActive: {
    backgroundColor: colors.destructive,
    borderColor: colors.destructive,
  },
  btnLabel: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
    position: 'absolute',
    top: BTN_SIZE + 4,
  },
  btnLabelActive: {
    color: '#fff',
  },
  hangup: {
    width: HANDPUP_SIZE,
    height: HANDPUP_SIZE,
    borderRadius: HANDPUP_SIZE / 2,
    backgroundColor: '#E11D48',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '135deg' }],
    shadowColor: '#E11D48',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
  },
});
