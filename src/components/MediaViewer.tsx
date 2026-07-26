import { useRef, useCallback } from 'react';
import { Modal, Animated, StyleSheet, Dimensions, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const MIN_SCALE = 1;
const MAX_SCALE = 5;

interface Props {
  visible: boolean;
  uri: string | null;
  onClose: () => void;
}

export default function MediaViewer({ visible, uri, onClose }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const bgOpacity = useRef(new Animated.Value(1)).current;

  const baseScale = useRef(1);
  const baseTranslateX = useRef(0);
  const baseTranslateY = useRef(0);
  const lastScale = useRef(1);
  const isZoomed = useRef(false);

  const clampScale = (s: number) => Math.min(Math.max(s, MIN_SCALE), MAX_SCALE);

  const animateTo = useCallback((toScale: number, toX: number, toY: number) => {
    Animated.parallel([
      Animated.spring(scale, { toValue: toScale, useNativeDriver: true }),
      Animated.spring(translateX, { toValue: toX, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: toY, useNativeDriver: true }),
    ]).start();
    lastScale.current = toScale;
    isZoomed.current = toScale > 1;
  }, [scale, translateX, translateY]);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      const newScale = clampScale(baseScale.current * e.scale);
      scale.setValue(newScale);
      isZoomed.current = newScale > 1;
    })
    .onEnd(() => {
      const currentScale = clampScale(baseScale.current * (scale as any).__getValue());
      if (currentScale <= 1) {
        animateTo(1, 0, 0);
        baseScale.current = 1;
      } else {
        lastScale.current = currentScale;
        scale.setValue(currentScale);
        isZoomed.current = true;
        baseScale.current = currentScale;
      }
    });

  const panGesture = Gesture.Pan()
    .activeOffsetY([-15, 15])
    .activeOffsetX([-15, 15])
    .onUpdate((e) => {
      if (isZoomed.current) {
        translateX.setValue(baseTranslateX.current + e.translationX);
        translateY.setValue(baseTranslateY.current + e.translationY);
      } else {
        const pullProgress = Math.min(Math.abs(e.translationY) / SCREEN_H, 1);
        bgOpacity.setValue(1 - pullProgress * 0.6);
        translateY.setValue(e.translationY * 0.4);
        scale.setValue(1 - pullProgress * 0.15);
      }
    })
    .onEnd((e) => {
      if (isZoomed.current) {
        baseTranslateX.current += e.translationX;
        baseTranslateY.current += e.translationY;
        return;
      }
      if (Math.abs(e.translationY) > SCREEN_H * 0.2) {
        Animated.timing(bgOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
        Animated.spring(translateY, { toValue: e.translationY > 0 ? SCREEN_H : -SCREEN_H, useNativeDriver: true }).start(() => onClose());
        return;
      }
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
        Animated.timing(bgOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      baseScale.current = 1;
      baseTranslateX.current = 0;
      baseTranslateY.current = 0;
      lastScale.current = 1;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const toScale = isZoomed.current ? 1 : 2.5;
      animateTo(toScale, 0, 0);
      baseScale.current = toScale;
      baseTranslateX.current = 0;
      baseTranslateY.current = 0;
    });

  const imageGestures = Gesture.Simultaneous(
    doubleTap,
    pinchGesture,
    panGesture
  );

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill}>
        <Animated.View style={[styles.backdrop, { opacity: bgOpacity }]} />
      </BlurView>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <GestureDetector gesture={imageGestures}>
          <Animated.View style={StyleSheet.absoluteFill}>
            {uri && (
              <Animated.View style={[styles.imageContainer, { transform: [{ translateX }, { translateY }, { scale }] }]}>
                <Image
                  source={uri}
                  style={styles.image}
                  contentFit="contain"
                  transition={200}
                />
              </Animated.View>
            )}
          </Animated.View>
        </GestureDetector>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_W,
    height: SCREEN_H,
  },
});
