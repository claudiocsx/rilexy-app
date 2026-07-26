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
  const pipOpacity = useRef(new Animated.Value(1)).current;

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
      onPanResponderRelease: (_, gs) => {
        pan.flattenOffset();
        const screenW = 400;
        if (gs.moveX < screenW / 2) {
          Animated.spring(pan.x, { toValue: 8, useNativeDriver: true }).start();
        } else {
          Animated.spring(pan.x, { toValue: screenW - PIP_SIZE.width - 8, useNativeDriver: true }).start();
        }
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
        {status === 'connected' && (
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
          </View>
        )}
      </View>

      {localStream && RTCView && (
        <Animated.View
          style={[
            styles.localContainer,
            { transform: [{ translateX: pan.x }, { translateY: pan.y }], opacity: pipOpacity },
          ]}
          {...panResponder.panHandlers}
        >
          <View style={styles.localGlow} />
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
    borderWidth: 2,
    borderColor: colors.accent,
  },
  avatarInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
    opacity: 0.3,
  },
  statusBadge: {
    position: 'absolute',
    top: 50,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  localContainer: {
    position: 'absolute',
    top: 60,
    right: 16,
    width: PIP_SIZE.width,
    height: PIP_SIZE.height,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  localGlow: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.3)',
    borderRadius: 16,
    zIndex: 2,
  },
  localVideo: {
    flex: 1,
  },
  localBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
  },
});
