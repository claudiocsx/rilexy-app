import { useRef } from 'react';
import { Modal, Animated, StyleSheet, Dimensions, PanResponder } from 'react-native';
import { Image } from 'expo-image';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface Props {
  visible: boolean;
  uri: string | null;
  onClose: () => void;
}

export default function MediaViewer({ visible, uri, onClose }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const zoomed = useRef(false);
  const lastTapTs = useRef(0);
  const lastX = useRef(0);
  const lastY = useRef(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const moved = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const animateTo = (toScale: number, toX: number, toY: number) => {
    Animated.parallel([
      Animated.spring(scale, { toValue: toScale, useNativeDriver: true }),
      Animated.spring(translateX, { toValue: toX, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: toY, useNativeDriver: true }),
    ]).start();
    lastX.current = toX;
    lastY.current = toY;
    zoomed.current = toScale > 1;
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => {
        if (zoomed.current) return Math.abs(gs.dx) > 4 || Math.abs(gs.dy) > 4;
        return false;
      },

      onPanResponderGrant: (evt) => {
        startX.current = evt.nativeEvent.pageX;
        startY.current = evt.nativeEvent.pageY;
        moved.current = false;
        if (closeTimer.current) {
          clearTimeout(closeTimer.current);
          closeTimer.current = null;
        }
      },

      onPanResponderMove: (evt) => {
        const dx = evt.nativeEvent.pageX - startX.current;
        const dy = evt.nativeEvent.pageY - startY.current;
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
          moved.current = true;
        }
        if (zoomed.current) {
          translateX.setValue(lastX.current + dx / 2);
          translateY.setValue(lastY.current + dy / 2);
        }
      },

      onPanResponderRelease: () => {
        if (!moved.current) {
          const now = Date.now();
          if (now - lastTapTs.current < 300) {
            const toScale = zoomed.current ? 1 : 2;
            animateTo(toScale, 0, 0);
            lastTapTs.current = 0;
          } else {
            lastTapTs.current = now;
            closeTimer.current = setTimeout(() => {
              if (lastTapTs.current === now) {
                lastTapTs.current = 0;
                onClose();
              }
            }, 300);
          }
          return;
        }
        if (zoomed.current) {
          lastX.current = (translateX as any).__getValue();
          lastY.current = (translateY as any).__getValue();
        }
      },
    })
  ).current;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <Animated.View style={styles.backdrop} {...panResponder.panHandlers}>
        {uri && (
          <Animated.View style={[styles.image, { transform: [{ translateX }, { translateY }, { scale }] }]}>
            <Image
              source={uri}
              style={styles.imageInner}
              contentFit="contain"
              transition={200}
            />
          </Animated.View>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_W,
    height: SCREEN_H,
  },
  imageInner: {
    width: '100%',
    height: '100%',
  },
});
