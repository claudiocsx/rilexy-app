import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
  AccessibilityInfo,
} from 'react-native';
import { Image } from 'expo-image';
import { useAuth } from '../contexts/AuthContext';
import { StoryGroup, markViewed } from '../services/stories';
import { colors } from '../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STORY_DURATION = 5000;
const PROGRESS_BAR_HEIGHT = 2;

interface Props {
  visible: boolean;
  groups: StoryGroup[];
  startIndex: number;
  onClose: () => void;
}

function isLightColor(hex?: string): boolean {
  if (!hex) return false;
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 155;
}

export default function StoryViewer({ visible, groups, startIndex, onClose }: Props) {
  const { user } = useAuth();
  const [groupIdx, setGroupIdx] = useState(startIndex);
  const [storyIdx, setStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const viewedRef = useRef<Set<string>>(new Set());
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  const currentGroup = groups[groupIdx];
  const currentStories = currentGroup?.stories || [];
  const currentStory = currentStories[storyIdx];

  useEffect(() => {
    setGroupIdx(startIndex);
    setStoryIdx(0);
    setProgress(0);
    viewedRef.current = new Set();
  }, [startIndex, visible]);

  const reduceMotionRef = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((e) => { reduceMotionRef.current = e; });
  }, []);

  useEffect(() => {
    if (!visible || !currentStory) return;

    fadeAnim.setValue(0);
    scaleAnim.setValue(0.8);
    pulseAnim.setValue(1);

    if (!reduceMotionRef.current) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    } else {
      fadeAnim.setValue(1);
      scaleAnim.setValue(1);
    }

    if (pulseRef.current) pulseRef.current.stop();
    const tempTimer: { current: ReturnType<typeof setTimeout> | null } = { current: null };

    if (!reduceMotionRef.current) {
      pulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.04, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      );
      pulseRef.current.start();

      tempTimer.current = setTimeout(() => {
        if (pulseRef.current) pulseRef.current.stop();
      }, 10000);
    }

    if (currentStory.id && user && !viewedRef.current.has(currentStory.id)) {
      viewedRef.current.add(currentStory.id);
      markViewed(currentStory.id, user.uid).catch(() => {});
    }

    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(elapsed / STORY_DURATION, 1);
      setProgress(pct);

      if (pct >= 1) {
        goNext();
      }
    }, 100);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pulseRef.current) pulseRef.current.stop();
      if (tempTimer.current) clearTimeout(tempTimer.current);
    };
  }, [storyIdx, groupIdx, visible, currentStory?.id]);

  const goNext = useCallback(() => {
    if (!currentGroup) return;

    if (storyIdx < currentStories.length - 1) {
      setStoryIdx((i) => i + 1);
      setProgress(0);
    } else if (groupIdx < groups.length - 1) {
      setGroupIdx((i) => i + 1);
      setStoryIdx(0);
      setProgress(0);
    } else {
      onClose();
    }
  }, [storyIdx, groupIdx, currentGroup, currentStories.length, groups.length, onClose]);

  const goPrev = useCallback(() => {
    if (storyIdx > 0) {
      setStoryIdx((i) => i - 1);
      setProgress(0);
    } else if (groupIdx > 0) {
      setGroupIdx((i) => i - 1);
      setStoryIdx(groups[groupIdx - 1]?.stories.length - 1 || 0);
      setProgress(0);
    }
  }, [storyIdx, groupIdx, groups]);

  const handleTap = (evt: any) => {
    const x = evt.nativeEvent.locationX;
    if (x < SCREEN_WIDTH * 0.3) {
      goPrev();
    } else {
      goNext();
    }
  };

  if (!visible || !currentGroup) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.container}>
        <View style={styles.progressRow}>
          {currentStories.map((s, i) => (
            <View key={s.id} style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  i < storyIdx && styles.progressDone,
                  i === storyIdx && { width: `${progress * 100}%` },
                  i > storyIdx && styles.progressPending,
                ]}
              />
            </View>
          ))}
        </View>

        <View style={styles.header}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>
              {currentGroup.userName[0].toUpperCase()}
            </Text>
          </View>
          <Text style={styles.headerName}>{currentGroup.userName}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>X</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.touchArea}
          activeOpacity={1}
          onPress={handleTap}
        >
          {currentStory?.mediaUrl ? (
            <Image
              source={currentStory.mediaUrl}
              style={styles.media}
              contentFit="contain"
              transition={300}
            />
          ) : (
            <Animated.View style={[styles.textStory, { backgroundColor: currentStory?.bgColor || colors.bg, opacity: fadeAnim }]}>
              <Animated.Text style={[styles.textStoryContent, { color: currentStory?.bgColor ? (isLightColor(currentStory.bgColor) ? '#1a1a2e' : '#fff') : colors.text, transform: [{ scale: Animated.multiply(scaleAnim, pulseAnim) }] }]}>
                {currentStory?.text || ''}
              </Animated.Text>
            </Animated.View>
          )}
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  progressRow: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingTop: 52,
    paddingBottom: 8,
  },
  progressTrack: {
    flex: 1,
    height: PROGRESS_BAR_HEIGHT,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.white,
    borderRadius: 1,
  },
  progressDone: {
    width: '100%',
  },
  progressPending: {
    width: '0%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accentDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headerAvatarText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: 'bold',
  },
  headerName: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  touchArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  textStory: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  textStoryContent: {
    fontSize: 52,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 64,
  },
});
