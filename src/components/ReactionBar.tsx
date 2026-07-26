import { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

const REACTIONS = ['❤️', '😂', '😍', '😮', '😢', '🙏', '🔥', '🎉'];

interface Props {
  onReact: (emoji: string) => void;
  userReactions?: string[];
  onMorePress?: () => void;
}

export default function ReactionBar({ onReact, userReactions = [], onMorePress }: Props) {
  const pressAnims = useRef<Record<string, Animated.Value>>({});

  const getAnim = (emoji: string) => {
    if (!pressAnims.current[emoji]) {
      pressAnims.current[emoji] = new Animated.Value(1);
    }
    return pressAnims.current[emoji];
  };

  const handlePress = (emoji: string) => {
    const anim = getAnim(emoji);
    anim.setValue(0.7);
    Animated.spring(anim, {
      toValue: 1,
      friction: 3,
      tension: 200,
      useNativeDriver: true,
    }).start();
    onReact(emoji);
  };

  return (
    <View style={styles.container}>
      {REACTIONS.map((emoji) => {
        const isActive = userReactions.includes(emoji);
        return (
          <Animated.View key={emoji} style={{ transform: [{ scale: getAnim(emoji) }] }}>
            <TouchableOpacity
              style={[styles.reactionBtn, isActive && styles.reactionBtnActive]}
              onPress={() => handlePress(emoji)}
              activeOpacity={0.6}
            >
              <Text style={styles.reactionEmoji}>{emoji}</Text>
            </TouchableOpacity>
          </Animated.View>
        );
      })}
      {onMorePress && (
        <TouchableOpacity style={styles.moreBtn} onPress={onMorePress} activeOpacity={0.6}>
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 2,
    backgroundColor: colors.glassBg,
    borderRadius: 24,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,

  },
  reactionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionBtnActive: {
    backgroundColor: colors.accentDark,
  },
  reactionEmoji: {
    fontSize: 20,
  },
  moreBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: colors.glassBorder,
    marginLeft: 2,
  },
});
