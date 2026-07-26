import { useEffect, useRef, memo } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { useSettingsStore } from '../store/settingsStore';
import { getColors } from '../theme/colors';

type Variant = 'chat' | 'group' | 'post';

interface Props {
  variant?: Variant;
  count?: number;
}

function SkeletonItem({ variant }: { variant: Variant }) {
  const opacity = useRef(new Animated.Value(0.3)).current;
  const theme = useSettingsStore((s) => s.theme);
  const c = getColors(theme);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  if (variant === 'post') {
    return (
      <Animated.View style={[styles.postCard, { opacity, backgroundColor: c.surface, borderColor: c.borderLight }]}>
        <View style={styles.postHeader}>
          <View style={[styles.circle, { width: 40, height: 40, borderRadius: 20, backgroundColor: c.elevated }]} />
          <View style={[styles.line, { width: '40%', height: 14, backgroundColor: c.elevated }]} />
        </View>
        <View style={[styles.mediaBlock, { backgroundColor: c.elevated }]} />
        <View style={[styles.line, { width: '80%', height: 12, backgroundColor: c.elevated }]} />
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.row, { opacity, backgroundColor: c.surface, borderBottomColor: c.borderLight }]}>
      <View style={[styles.circle, { width: 48, height: 48, borderRadius: 24, backgroundColor: c.elevated }]} />
      <View style={styles.lines}>
        <View style={[styles.line, { width: '60%', height: 14, backgroundColor: c.elevated }]} />
        <View style={[styles.line, { width: '85%', height: 12, backgroundColor: c.elevated }]} />
      </View>
    </Animated.View>
  );
}

const SkeletonItemMemo = memo(SkeletonItem);

export default function SkeletonList({ variant = 'chat', count }: Props) {
  const itemCount = count ?? (variant === 'post' ? 3 : 6);
  return (
    <View style={styles.wrapper}>
      {Array.from({ length: itemCount }).map((_, i) => (
        <SkeletonItemMemo key={i} variant={variant} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  circle: {},
  lines: {
    flex: 1,
    gap: 8,
  },
  line: {
    borderRadius: 4,
  },
  postCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    paddingBottom: 16,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  mediaBlock: {
    width: '100%',
    aspectRatio: 1,
  },
});
