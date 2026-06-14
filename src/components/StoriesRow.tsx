import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { StoryGroup, Story, observeMyStory, observeStories } from '../services/stories';
import { colors } from '../theme/colors';

interface Props {
  onPressMyStory: () => void;
  onPressStory: (groups: StoryGroup[], startIndex: number) => void;
}

const MY_STORY_SIZE = 64;
const STORY_SIZE = 60;

export default function StoriesRow({ onPressMyStory, onPressStory }: Props) {
  const { user } = useAuth();
  const [myStories, setMyStories] = useState<Story[]>([]);
  const [groups, setGroups] = useState<StoryGroup[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsubMy = observeMyStory(user.uid, setMyStories);

    const unsubOthers = observeStories((allGroups) => {
      const others = allGroups.filter((g) => g.userId !== user.uid);
      for (const group of others) {
        group.allViewed = group.stories.every(
          (s) => s.viewedBy?.includes(user.uid) ?? false
        );
      }
      setGroups(others);
    });

    return () => {
      unsubMy();
      unsubOthers();
    };
  }, [user]);

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <TouchableOpacity style={styles.myStory} onPress={onPressMyStory}>
          <View style={[styles.avatarRing, myStories.length > 0 && styles.avatarRingActive]}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(user?.displayName || 'U')[0].toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={styles.myLabel} numberOfLines={1}>Meu Status</Text>
        </TouchableOpacity>

        {groups.map((group, idx) => {
          const hasUnviewed = group.stories.some(
            (s) => !s.viewedBy?.includes(user?.uid || '')
          );
          return (
            <TouchableOpacity
              key={group.userId}
              style={styles.storyItem}
              onPress={() => onPressStory(groups, idx)}
            >
              <View style={[styles.avatarRing, hasUnviewed && styles.avatarRingUnviewed]}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {group.userName[0].toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={styles.label} numberOfLines={1}>{group.userName}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.surface,
    paddingVertical: 12,
  },
  scroll: {
    paddingHorizontal: 12,
    gap: 16,
  },
  myStory: {
    alignItems: 'center',
    width: MY_STORY_SIZE + 8,
  },
  storyItem: {
    alignItems: 'center',
    width: STORY_SIZE + 8,
  },
  avatarRing: {
    width: MY_STORY_SIZE + 4,
    height: MY_STORY_SIZE + 4,
    borderRadius: (MY_STORY_SIZE + 4) / 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.elevated,
  },
  avatarRingActive: {
    borderColor: colors.accent,
  },
  avatarRingUnviewed: {
    borderColor: colors.accent,
    borderWidth: 3,
  },
  avatar: {
    width: MY_STORY_SIZE - 4,
    height: MY_STORY_SIZE - 4,
    borderRadius: (MY_STORY_SIZE - 4) / 2,
    backgroundColor: colors.accentDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: colors.text,
    fontSize: 22,
    fontWeight: 'bold',
  },
  myLabel: {
    color: colors.accent,
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
    maxWidth: STORY_SIZE + 8,
  },
});
