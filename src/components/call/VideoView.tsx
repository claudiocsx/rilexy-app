import { useRef } from 'react';
import { View, StyleSheet, PanResponder, Animated } from 'react-native';
import { colors } from '../../theme/colors';

interface VideoViewProps {
  remoteStream: any;
  localStream: any;
  RTCView: any;
  peerName: string;
  status: string;
}

const PIP_SIZE = { width: 120, height: 180 };

export default function VideoView({ remoteStream, localStream, RTCView, peerName, status }: VideoViewProps) {
  const pan = useRef(new Animated.ValueXY({ x: 16, y: 100 })).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.extractOffset();
      },
      onPanResponderMove: (_, gs) => {
        pan.setValue({ x: gs.dx, y: gs.dy });
      },
      onPanResponderRelease: () => {
        pan.flattenOffset();
      },
    })
  ).current;

  return (
    <View style={styles.container}>
      <View style={styles.remoteContainer}>
        {remoteStream && RTCView ? (
          <RTCView
            streamURL={remoteStream.toURL?.() || ''}
            style={styles.remoteVideo}
            objectFit="cover"
          />
        ) : (
          <View style={styles.remoteFallback}>
            <View style={styles.avatarLarge}>
              <View style={styles.avatarInner} />
            </View>
          </View>
        )}
      </View>

      {localStream && RTCView && (
        <Animated.View
          style={[
            styles.localContainer,
            { transform: [{ translateX: pan.x }, { translateY: pan.y }] },
          ]}
          {...panResponder.panHandlers}
        >
          <RTCView
            streamURL={localStream.toURL?.() || ''}
            style={styles.localVideo}
            objectFit="cover"
          />
          <View style={styles.localBorder} />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  remoteContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  remoteVideo: {
    flex: 1,
  },
  remoteFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  avatarLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
    opacity: 0.3,
  },
  localContainer: {
    position: 'absolute',
    top: 60,
    right: 16,
    width: PIP_SIZE.width,
    height: PIP_SIZE.height,
    borderRadius: 12,
    overflow: 'hidden',
  },
  localVideo: {
    flex: 1,
  },
  localBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
  },
});
