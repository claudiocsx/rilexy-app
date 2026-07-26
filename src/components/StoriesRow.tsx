import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Animated,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { StoryGroup, Story, observeMyStory, observeStories } from '../services/stories';
import AvatarImage from './AvatarImage';
import { db } from '../services/firebase';
import { getColors } from '../theme/colors';
import { useSettingsStore } from '../store/settingsStore';
import IntentionBadge from './IntentionBadge';
import { INTENTIONS, IntentionType } from '../constants/intentions';
import { findOrCreateChat } from '../services/chat';

interface Props {
  onPressMyStory: (hasStories: boolean) => void;
  onPressStory: (groups: StoryGroup[], startIndex: number) => void;
  onPressAddMoment?: () => void;
}

const MY_RING = 68;
const MY_AVATAR = 60;
const RING = 64;
const AVATAR = 56;

function StoryRing({
  size,
  innerSize,
  active,
  photoURL,
  name,
  intentionColor,
  c,
}: {
  size: number;
  innerSize: number;
  active: boolean;
  photoURL?: string | null;
  name: string;
  intentionColor?: string;
  c: ReturnType<typeof getColors>;
}) {
  const ring = !active ? (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderColor: c.elevated,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <AvatarImage photoURL={photoURL} name={name} size={innerSize} />
    </View>
  ) : (
    <LinearGradient
      colors={['#a78bfa', '#7c3aed', '#ec4899']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 2,
      }}
    >
      <View
        style={{
          width: innerSize,
          height: innerSize,
          borderRadius: innerSize / 2,
          overflow: 'hidden',
          backgroundColor: c.bg,
        }}
      >
        <AvatarImage photoURL={photoURL} name={name} size={innerSize} />
      </View>
    </LinearGradient>
  );

  if (intentionColor) {
    const glowSize = size + 8;
    return (
      <View style={{ position: 'relative' }}>
        <View
          style={{
            position: 'absolute',
            top: -4,
            left: -4,
            width: glowSize,
            height: glowSize,
            borderRadius: glowSize / 2,
            backgroundColor: intentionColor,
            opacity: 0.2,
          }}
        />
        {ring}
      </View>
    );
  }

  return ring;
}

function IntentionLabel({ type }: { type: string | null }) {
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const c = getColors(useSettingsStore((s) => s.theme));

  useEffect(() => {
    if (!type || !(type in INTENTIONS)) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [type]);

  if (!type || !(type in INTENTIONS)) return null;
  const int = INTENTIONS[type as IntentionType];

  return (
    <Animated.Text
      style={{
        color: int.color,
        fontSize: 10,
        fontWeight: '600',
        marginTop: 2,
        textAlign: 'center',
        opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }),
        transform: [{
          scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }),
        }],
      }}
      numberOfLines={1}
    >
      {int.emoji} {int.label}
    </Animated.Text>
  );
}

export default function StoriesRow({ onPressMyStory, onPressStory, onPressAddMoment }: Props) {
  const theme = useSettingsStore((s) => s.theme);
  const c = getColors(theme);
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [myStories, setMyStories] = useState<Story[]>([]);
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [myIntention, setMyIntention] = useState<string | null>(null);
  const [contactIntentions, setContactIntentions] = useState<Record<string, string>>({});
  const [badgeNavigating, setBadgeNavigating] = useState(false);

  const intentionColor = myIntention && myIntention in INTENTIONS
    ? INTENTIONS[myIntention as IntentionType].color
    : undefined;

  const handleIntentionTap = async (contactUserId: string, contactName: string, contactPhoto: string | undefined, intentionKey: string) => {
    if (!user || badgeNavigating) return;
    if (!(intentionKey in INTENTIONS)) return;
    setBadgeNavigating(true);
    try {
      const chatId = await findOrCreateChat(user.uid, contactUserId, contactName);
      navigation.navigate('Chat', {
        chatId,
        name: contactName,
        photoURL: contactPhoto,
        initialText: INTENTIONS[intentionKey as IntentionType].replyText,
      });
    } catch { /* silence */ } finally {
      setBadgeNavigating(false);
    }
  };

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

    const unsubMyIntention = db.collection('users').doc(user.uid).onSnapshot((doc) => {
      if (doc.exists) {
        setMyIntention(doc.data()?.intention || null);
      }
    });

    return () => {
      unsubMy();
      unsubOthers();
      unsubMyIntention();
    };
  }, [user]);

  useEffect(() => {
    if (!user || groups.length === 0) return;
    const unsubs = groups.map((g) =>
      db.collection('users').doc(g.userId).onSnapshot((doc) => {
        if (doc.exists) {
          setContactIntentions((prev) => ({ ...prev, [g.userId]: doc.data()?.intention || null }));
        }
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [user, groups]);

  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: c.glassBorder, backgroundColor: c.glassBg, paddingVertical: 12 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 16 }}>
        <Pressable accessibilityLabel="Momentos" style={{ alignItems: 'center', width: MY_RING + 4 }} onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onPressMyStory(myStories.length > 0);
        }}>
          <View style={{ position: 'relative' }}>
            <StoryRing
              size={MY_RING}
              innerSize={MY_AVATAR}
              active={myStories.length > 0}
              photoURL={user?.photoURL}
              name={user?.displayName || 'U'}
              intentionColor={intentionColor}
              c={c}
            />
            <IntentionBadge type={myIntention} style={{ position: 'absolute', bottom: 0, right: 0 }} />
            {onPressAddMoment && (
              <Pressable accessibilityLabel="Adicionar momento" style={{ position: 'absolute', top: -2, right: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: c.accent, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: c.bg }} onPress={onPressAddMoment} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="add" size={14} color={c.bg} />
              </Pressable>
            )}
          </View>
          <Text style={{ color: c.accent, fontSize: 11, marginTop: 6, textAlign: 'center' }} numberOfLines={1}>Momentos</Text>
           <IntentionLabel type={myIntention} />
        </Pressable>

        {groups.map((group, idx) => {
          const hasUnviewed = group.stories.some(
            (s) => !s.viewedBy?.includes(user?.uid || '')
          );
          const contactIntention = contactIntentions[group.userId];
          const contactIntColor = contactIntention && contactIntention in INTENTIONS
            ? INTENTIONS[contactIntention as IntentionType].color
            : undefined;
          return (
            <Pressable
              key={group.userId}
              accessibilityLabel={"Story de " + group.userName}
              style={{ alignItems: 'center', width: RING + 4 }}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onPressStory(groups, idx);
              }}
            >
              <View style={{ position: 'relative' }}>
                <StoryRing
                  size={RING}
                  innerSize={AVATAR}
                  active={hasUnviewed}
                  photoURL={group.photoURL}
                  name={group.userName}
                  intentionColor={contactIntColor}
                  c={c}
                />
                {contactIntention ? (
                  <Pressable
                    accessibilityLabel={"Responder a " + group.userName}
                    style={{ position: 'absolute', bottom: 0, right: 0 }}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      handleIntentionTap(group.userId, group.userName, group.photoURL, contactIntention);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <IntentionBadge type={contactIntention} />
                  </Pressable>
                ) : null}
              </View>
              <Text style={{ color: c.textMuted, fontSize: 11, marginTop: 6, textAlign: 'center', maxWidth: RING + 4 }} numberOfLines={1}>{group.userName}</Text>
              <IntentionLabel type={contactIntention} />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
