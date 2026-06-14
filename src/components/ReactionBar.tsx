import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

const REACTIONS = ['❤️', '😂', '😍', '😮', '😢', '🙏', '🔥', '🎉'];

interface Props {
  onReact: (emoji: string) => void;
  userReactions?: string[];
}

export default function ReactionBar({ onReact, userReactions = [] }: Props) {
  return (
    <View style={styles.container}>
      {REACTIONS.map((emoji) => {
        const isActive = userReactions.includes(emoji);
        return (
          <TouchableOpacity
            key={emoji}
            style={[styles.reactionBtn, isActive && styles.reactionBtnActive]}
            onPress={() => onReact(emoji)}
            activeOpacity={0.6}
          >
            <Text style={styles.reactionEmoji}>{emoji}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 2,
    backgroundColor: colors.surface,
    borderRadius: 24,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
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
});
