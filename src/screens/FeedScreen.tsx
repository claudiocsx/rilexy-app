import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  Alert,
  RefreshControl,
  Animated,
  Dimensions,
  Modal,
  ListRenderItem,
  Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useVideoPlayer, VideoView } from 'expo-video';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AvatarImage from '../components/AvatarImage';
import { db } from '../services/firebase';
import firebase from 'firebase/compat/app';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import StoriesRow from '../components/StoriesRow';
import StoryViewer from '../components/StoryViewer';
import CommentsModal from '../components/CommentsModal';
import MediaViewer from '../components/MediaViewer';
import VideoPlayer from '../components/VideoPlayer';
import { File, Paths, Directory } from 'expo-file-system';
import { StoryGroup } from '../services/stories';
import { decryptAndCache, extractStoragePath, pathHash } from '../services/crypto';
import { deleteMedia } from '../services/storage';
import { parsePostText, TextSegment } from '../utils/textParser';
import { observeMutedUids, muteUser } from '../services/mute';
import { reportPost, REPORT_REASONS } from '../services/report';

const SCREEN_W = Dimensions.get('window').width;
const REACTION_EMOJIS = ['❤️', '😂', '😢', '😡', '👍'];
type FeedTab = 'forYou' | 'following' | 'favorites';

const TAB_LABELS: Record<FeedTab, string> = {
  forYou: 'Para Você',
  following: 'Seguindo',
  favorites: 'Favoritos',
};

function CarouselDot({ index, animatedValue }: { index: number; animatedValue: Animated.Value }) {
  const opacity = animatedValue.interpolate({
    inputRange: [index - 1, index, index + 1],
    outputRange: [0.3, 1, 0.3],
    extrapolate: 'clamp',
  });
  const scale = animatedValue.interpolate({
    inputRange: [index - 1, index, index + 1],
    outputRange: [0.8, 1.2, 0.8],
    extrapolate: 'clamp',
  });
  return (
    <Animated.View style={[styles.dot, { opacity, transform: [{ scale }] }]} />
  );
}

function SkeletonPost() {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <Animated.View style={[styles.skeletonCircle, { opacity: pulse }]} />
        <View style={{ flex: 1, marginLeft: 10, gap: 6 }}>
          <Animated.View style={[styles.skeletonLine, { width: '50%', opacity: pulse }]} />
          <Animated.View style={[styles.skeletonLine, { width: '30%', opacity: pulse, height: 8 }]} />
        </View>
      </View>
      <Animated.View style={[styles.skeletonMedia, { opacity: pulse }]} />
      <View style={{ paddingHorizontal: 14, paddingTop: 10, gap: 6 }}>
        <Animated.View style={[styles.skeletonLine, { width: '80%', opacity: pulse }]} />
        <Animated.View style={[styles.skeletonLine, { width: '55%', opacity: pulse }]} />
      </View>
      <View style={[styles.postActions, { paddingTop: 10 }]}>
        <Animated.View style={[styles.skeletonLine, { width: 40, opacity: pulse, height: 20, borderRadius: 10 }]} />
        <Animated.View style={[styles.skeletonLine, { width: 40, opacity: pulse, height: 20, borderRadius: 10 }]} />
        <Animated.View style={[styles.skeletonLine, { width: 24, opacity: pulse, height: 20, borderRadius: 10 }]} />
      </View>
    </View>
  );
}

interface Post {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  mediaUrl?: string;
  mediaKey?: string;
  mediaIv?: string;
  mediaUrls?: string[];
  mediaKeys?: string[];
  mediaIvs?: string[];
  mediaType?: string;
  timestamp: any;
  likesCount: number;
  commentsCount: number;
  likedBy?: string[];
  reactions?: { [emoji: string]: string[] };
  savedBy?: string[];
}

function formatTimeAgo(timestamp: any): string {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return 'Agora';
  if (diff < 3600) return `Há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Há ${Math.floor(diff / 3600)} h`;
  return `Há ${Math.floor(diff / 86400)} d`;
}

function RenderTextWithLinks({
  text,
  onPressHashtag,
  onPressMention,
}: {
  text: string;
  onPressHashtag: (tag: string) => void;
  onPressMention: (displayName: string) => void;
}) {
  const segments = useMemo(() => parsePostText(text), [text]);
  return (
    <Text style={styles.postText}>
      {segments.map((seg, i) => {
        if (seg.type === 'hashtag') {
          return (
            <Text key={i} style={styles.hashtag} onPress={() => onPressHashtag(seg.tag)}>
              {seg.content}
            </Text>
          );
        }
        if (seg.type === 'mention') {
          return (
            <Text key={i} style={styles.mention} onPress={() => onPressMention(seg.displayName)}>
              {seg.content}
            </Text>
          );
        }
        return <Text key={i}>{seg.content}</Text>;
      })}
    </Text>
  );
}

function FeedVideo({ uri, isActive }: { uri: string; isActive: boolean }) {
  const player = useVideoPlayer({ uri }, (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    if (isActive) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, player]);

  return (
    <VideoView
      player={player}
      style={styles.postMedia}
      contentFit="cover"
    />
  );
}

interface PostItemProps {
  item: Post;
  currentUserId: string | undefined;
  decryptedUris: Record<string, string[]>;
  commentText: Record<string, string>;
  isVisible: boolean;
  onLike: (postId: string, likedBy?: string[]) => void;
  onReact: (postId: string, emoji: string, reactions?: { [emoji: string]: string[] }) => void;
  onBookmark: (postId: string, savedBy?: string[]) => void;
  onDeletePost: (postId: string, mediaUrl?: string, mediaType?: string) => void;
  onEditPost: (post: Post) => void;
  onSharePost: (post: Post) => void;
  onComment: (postId: string) => void;
  onCommentTextChange: (postId: string, text: string) => void;
  onSelectMedia: (uri: string) => void;
  onSelectVideo: (uri: string) => void;
  onSelectComments: (postId: string) => void;
  onPressHashtag: (tag: string) => void;
  onPressMention: (displayName: string) => void;
  onMuteUser: (uid: string, name: string) => void;
}

function PostItem({
  item,
  currentUserId,
  decryptedUris,
  commentText,
  isVisible,
  onLike,
  onReact,
  onBookmark,
  onDeletePost,
  onEditPost,
  onSharePost,
  onComment,
  onCommentTextChange,
  onSelectMedia,
  onSelectVideo,
  onSelectComments,
  onPressHashtag,
  onPressMention,
  onMuteUser,
}: PostItemProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const heartScale = useRef(new Animated.Value(0)).current;
  const carouselIndex = useRef(new Animated.Value(0)).current;
  const reactionPickerAnim = useRef(new Animated.Value(0)).current;

  const liked = item.likedBy?.includes(currentUserId || '') ?? false;
  const isSaved = item.savedBy?.includes(currentUserId || '') ?? false;
  const allMediaUris = decryptedUris[item.id] || item.mediaUrls || (item.mediaUrl ? [item.mediaUrl] : []);
  const postUri = allMediaUris[0] || null;
  const hasMultipleMedia = allMediaUris.length > 1;

  const userReactions = useMemo(() => {
    if (!item.reactions || !currentUserId) return [];
    return Object.entries(item.reactions)
      .filter(([, uids]) => uids.includes(currentUserId))
      .map(([emoji]) => emoji);
  }, [item.reactions, currentUserId]);

  const totalReactions = useMemo(() => {
    if (!item.reactions) return 0;
    return Object.values(item.reactions).reduce((sum, uids) => sum + uids.length, 0);
  }, [item.reactions]);

  const topReactions = useMemo(() => {
    if (!item.reactions) return [];
    return Object.entries(item.reactions)
      .filter(([, uids]) => uids.length > 0)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 3)
      .map(([emoji, uids]) => ({ emoji, count: uids.length }));
  }, [item.reactions]);

  const triggerHeartAnimation = () => {
    heartScale.setValue(0);
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1, tension: 100, friction: 6, useNativeDriver: true }),
      Animated.delay(600),
      Animated.timing(heartScale, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const doubleTap = useMemo(() =>
    Gesture.Tap()
      .numberOfTaps(2)
      .onEnd(() => {
        if (!liked) onLike(item.id, item.likedBy);
        triggerHeartAnimation();
      }),
  [liked, item.id, item.likedBy]);

  const singleTap = useMemo(() =>
    Gesture.Tap()
      .requireExternalGestureToFail(doubleTap)
      .onEnd(() => {
        if (!postUri) return;
        if (item.mediaType === 'video' || /\.(mp4|mov|webm)$/i.test(postUri)) {
          onSelectVideo(postUri);
        } else {
          onSelectMedia(postUri);
        }
      }),
  [doubleTap, postUri, item.mediaType]);

  const mediaGesture = Gesture.Simultaneous(doubleTap, singleTap);

  const longPressLike = useMemo(() =>
    Gesture.LongPress()
      .minDuration(400)
      .onEnd(() => {
        setShowReactionPicker(true);
      }),
  []);

  const onCarouselScroll = useCallback((e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    carouselIndex.setValue(idx);
  }, []);

  const handleReact = (emoji: string) => {
    onReact(item.id, emoji, item.reactions);
    setShowReactionPicker(false);
  };

  const isVideo = (uri: string) => item.mediaType === 'video' || /\.(mp4|mov|webm)$/i.test(uri);

  useEffect(() => {
    Animated.spring(reactionPickerAnim, {
      toValue: showReactionPicker ? 1 : 0,
      tension: 120,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, [showReactionPicker]);

  const isOwnPost = item.senderId === currentUserId;

  return (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <Pressable onPress={() => navigation.navigate('UserProfile', { userId: item.senderId })}>
          <AvatarImage photoURL={item.senderPhoto} name={item.senderName} size={36} />
        </Pressable>
        <View style={styles.postHeaderInfo}>
          <Pressable onPress={() => navigation.navigate('UserProfile', { userId: item.senderId })}>
            <Text style={styles.senderName}>{item.senderName}</Text>
          </Pressable>
          <Text style={styles.timeAgo}>{formatTimeAgo(item.timestamp)}</Text>
        </View>
        {isOwnPost ? (
          <View style={styles.postHeaderActions}>
            <Pressable onPress={() => onEditPost(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
              <Ionicons name="pencil" size={16} color={colors.textMuted} />
            </Pressable>
            <Pressable onPress={() => onDeletePost(item.id, item.mediaUrl || item.mediaUrls?.[0], item.mediaType)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
              <Ionicons name="trash-outline" size={16} color={colors.destructive} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              Alert.alert('Opções', '', [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Silenciar ' + item.senderName,
                  onPress: () => onMuteUser(item.senderId, item.senderName),
                },
                {
                  text: 'Reportar post',
                  style: 'destructive',
                  onPress: () => {
                    setReportPostData({ id: item.id, senderId: item.senderId, text: item.text, mediaUrl: item.mediaUrl || item.mediaUrls?.[0] || '' });
                    setReportModalVisible(true);
                  },
                },
              ]);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1, padding: 4 }]}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {postUri ? (
        <GestureDetector gesture={mediaGesture}>
          <View>
            {hasMultipleMedia ? (
              <>
                <FlatList
                  data={allMediaUris}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onScroll={onCarouselScroll}
                  scrollEventThrottle={16}
                  keyExtractor={(_, i) => `${item.id}_${i}`}
                  renderItem={({ item: uri }) => {
                    if (isVideo(uri)) {
                      return <FeedVideo uri={uri} isActive={isVisible} />;
                    }
                    return (
                      <Image
                        source={uri}
                        style={styles.carouselMedia}
                        contentFit="cover"
                        transition={300}
                      />
                    );
                  }}
                />
                <View style={styles.dotsContainer}>
                  {allMediaUris.map((_, i) => (
                    <CarouselDot key={i} index={i} animatedValue={carouselIndex} />
                  ))}
                </View>
              </>
            ) : isVideo(postUri) ? (
              <FeedVideo uri={postUri} isActive={isVisible} />
            ) : (
              <Image
                source={postUri}
                style={styles.postMedia}
                contentFit="cover"
                transition={300}
              />
            )}
            <Animated.View style={[styles.heartOverlay, { transform: [{ scale: heartScale }], opacity: heartScale }]} pointerEvents="none">
              <Ionicons name="heart" size={80} color={colors.destructive} />
            </Animated.View>
          </View>
        </GestureDetector>
      ) : null}

      {item.text ? (
        <RenderTextWithLinks
          text={item.text}
          onPressHashtag={onPressHashtag}
          onPressMention={onPressMention}
        />
      ) : null}

      {(topReactions.length > 0 || totalReactions > 0) && (
        <View style={styles.reactionsSummary}>
          {topReactions.map(({ emoji, count }) => (
            <View key={emoji} style={styles.reactionBadge}>
              <Text style={styles.reactionBadgeEmoji}>{emoji}</Text>
              <Text style={styles.reactionBadgeCount}>{count}</Text>
            </View>
          ))}
          {(item.likesCount > 0 || totalReactions > 0) && (
            <Text style={styles.reactionTotal}>
              {totalReactions > 0 ? totalReactions : item.likesCount}
            </Text>
          )}
        </View>
      )}

      <View style={styles.postActions}>
        <GestureDetector gesture={longPressLike}>
          <Pressable
            style={styles.actionButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onLike(item.id, item.likedBy);
            }}
          >
            {({ pressed }) => (
              <>
                <Ionicons
                  name={liked ? 'heart' : 'heart-outline'}
                  size={22}
                  color={liked ? colors.destructive : colors.textMuted}
                />
                {userReactions.length > 0 && (
                  <View style={styles.userReactionBadge}>
                    <Text style={styles.userReactionEmoji}>{userReactions[0]}</Text>
                  </View>
                )}
              </>
            )}
          </Pressable>
        </GestureDetector>

        <Pressable style={styles.actionButton} onPress={() => onSelectComments(item.id)}>
          {({ pressed }) => (
            <>
              <Ionicons name="chatbubble-outline" size={20} color={pressed ? colors.accent : colors.textMuted} />
              <Text style={[styles.actionCount, pressed && { color: colors.accent }]}>{item.commentsCount || 0}</Text>
            </>
          )}
        </Pressable>

        <Pressable style={styles.actionButton} onPress={() => onSharePost(item)}>
          {({ pressed }) => (
            <Ionicons name="share-outline" size={20} color={pressed ? colors.accent : colors.textMuted} />
          )}
        </Pressable>

        <Pressable style={styles.actionButtonRight} onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          onBookmark(item.id, item.savedBy);
        }}>
          {({ pressed }) => (
            <Ionicons
              name={isSaved ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color={isSaved ? colors.accent : pressed ? colors.accent : colors.textMuted}
            />
          )}
        </Pressable>
      </View>

      {showReactionPicker && (
        <Pressable style={styles.reactionPickerOverlay} onPress={() => setShowReactionPicker(false)}>
          <Animated.View
            style={[
              styles.reactionPicker,
              {
                opacity: reactionPickerAnim,
                transform: [{
                  scale: reactionPickerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.5, 1],
                  }),
                }],
              },
            ]}
          >
            {REACTION_EMOJIS.map((emoji, i) => (
              <Animated.View
                key={emoji}
                style={{
                  opacity: reactionPickerAnim,
                  transform: [{
                    scale: reactionPickerAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 1],
                    }),
                  }],
                }}
              >
                <Pressable onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  handleReact(emoji);
                }} style={styles.reactionEmojiBtn}>
                  <Text style={styles.reactionEmoji}>{emoji}</Text>
                </Pressable>
              </Animated.View>
            ))}
          </Animated.View>
        </Pressable>
      )}

      <View style={styles.commentInputRow}>
        <TextInput
          style={styles.commentInput}
          placeholder="Comentar..."
          placeholderTextColor={colors.textMuted}
          value={commentText[item.id] || ''}
          onChangeText={(t) => onCommentTextChange(item.id, t)}
        />
        <Pressable onPress={() => {
          if (commentText[item.id]?.trim()) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            onComment(item.id);
          }
        }} disabled={!commentText[item.id]?.trim()}>
          <Ionicons name="send" size={18} color={commentText[item.id]?.trim() ? colors.accent : colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

export default function FeedScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [storyViewerIndex, setStoryViewerIndex] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPostForComments, setSelectedPostForComments] = useState<string | null>(null);
  const [selectedMediaUri, setSelectedMediaUri] = useState<string | null>(null);
  const [selectedVideoUri, setSelectedVideoUri] = useState<string | null>(null);
  const [decryptedUris, setDecryptedUris] = useState<Record<string, string[]>>({});
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editText, setEditText] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [sharingPost, setSharingPost] = useState<Post | null>(null);
  const [shareChats, setShareChats] = useState<{ id: string; name: string }[]>([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<FeedTab>('forYou');
  const [followingUids, setFollowingUids] = useState<Set<string>>(new Set());
  const [visiblePostIds, setVisiblePostIds] = useState<Set<string>>(new Set());
  const [mutedUids, setMutedUids] = useState<Set<string>>(new Set());
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportPostData, setReportPostData] = useState<{ id: string; senderId: string; text: string; mediaUrl: string } | null>(null);
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [reportSending, setReportSending] = useState(false);

  const tabIndicatorX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const tabs: FeedTab[] = ['forYou', 'following', 'favorites'];
    const idx = tabs.indexOf(activeTab);
    Animated.spring(tabIndicatorX, {
      toValue: idx * (SCREEN_W / 3),
      tension: 150,
      friction: 12,
      useNativeDriver: false,
    }).start();
  }, [activeTab]);

  useEffect(() => {
    const pending = posts
      .filter((p) => p.mediaUrl || p.mediaUrls?.length)
      .map((p) => {
        const urls = p.mediaUrls?.length ? p.mediaUrls : p.mediaUrl ? [p.mediaUrl] : [];
        const keys = p.mediaKeys?.length ? p.mediaKeys : p.mediaKey ? [p.mediaKey] : [];
        const ivs = p.mediaIvs?.length ? p.mediaIvs : p.mediaIv ? [p.mediaIv] : [];
        const mime = p.mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
        const decrypts = urls.map((url, i) =>
          decryptAndCache(url, keys[i] || null, ivs[i] || null, mime).catch(() => null)
        );
        return Promise.all(decrypts).then((uris) => ({
          id: p.id,
          uris: uris.filter(Boolean) as string[],
        }));
      });
    if (pending.length > 0) {
      Promise.all(pending).then((results) => {
        const map: Record<string, string[]> = {};
        for (const r of results) {
          if (r.uris.length > 0) map[r.id] = r.uris;
        }
        setDecryptedUris((prev) => ({ ...prev, ...map }));
      });
    }
  }, [posts]);

  useEffect(() => {
    if (!user) return;
    return db.collection('chats')
      .where('participants', 'array-contains', user.uid)
      .onSnapshot((snap) => {
        const uids = new Set<string>();
        snap.docs.forEach((doc) => {
          const participants = doc.data().participants || [];
          participants.forEach((uid: string) => {
            if (uid !== user.uid) uids.add(uid);
          });
        });
        setFollowingUids(uids);
      }, () => {});
  }, [user?.uid]);

  useEffect(() => {
    if (!user) return;
    return observeMutedUids(user.uid, (uids) => {
      setMutedUids(new Set(uids));
    });
  }, [user?.uid]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  useEffect(() => {
    return db.collection('posts').orderBy('timestamp', 'desc').onSnapshot((snapshot) => {
      const postsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Post[];
      setPosts(postsData);
      setLoading(false);
      setError(null);
    }, (err) => {
      setLoading(false);
      setError('Erro ao carregar posts');
      console.error('Posts onSnapshot error:', err);
    });
  }, []);

  const filteredPosts = useMemo(() => {
    let result = posts;
    if (mutedUids.size > 0) {
      result = result.filter((p) => !mutedUids.has(p.senderId));
    }
    if (activeTab === 'following') {
      result = result.filter((p) => followingUids.has(p.senderId));
    } else if (activeTab === 'favorites') {
      result = result.filter((p) => p.savedBy?.includes(user?.uid || ''));
    }
    return result;
  }, [posts, activeTab, followingUids, mutedUids, user?.uid]);

  const handleViewableItemsChanged = useCallback((info: { viewableItems: any[] }) => {
    const ids = new Set(info.viewableItems.map((v: any) => v.item.id));
    setVisiblePostIds(ids);
  }, []);

  const viewabilityConfig = useMemo(() => ({
    itemVisiblePercentThreshold: 50,
  }), []);

  const handleLike = async (postId: string, likedBy: string[] = []) => {
    if (!user) return;
    const alreadyLiked = likedBy.includes(user.uid);
    try {
      if (alreadyLiked) {
        await db.collection('posts').doc(postId).update({
          likedBy: firebase.firestore.FieldValue.arrayRemove(user.uid),
          likesCount: firebase.firestore.FieldValue.increment(-1),
        });
      } else {
        await db.collection('posts').doc(postId).update({
          likedBy: firebase.firestore.FieldValue.arrayUnion(user.uid),
          likesCount: firebase.firestore.FieldValue.increment(1),
        });
      }
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Não foi possível curtir');
    }
  };

  const handleReact = async (postId: string, emoji: string, reactions?: { [emoji: string]: string[] }) => {
    if (!user) return;
    const alreadyReacted = reactions?.[emoji]?.includes(user.uid);
    try {
      if (alreadyReacted) {
        await db.collection('posts').doc(postId).update({
          [`reactions.${emoji}`]: firebase.firestore.FieldValue.arrayRemove(user.uid),
        });
      } else {
        const updates: any = {};
        if (reactions) {
          for (const [e, uids] of Object.entries(reactions)) {
            if (uids.includes(user.uid) && e !== emoji) {
              updates[`reactions.${e}`] = firebase.firestore.FieldValue.arrayRemove(user.uid);
            }
          }
        }
        updates[`reactions.${emoji}`] = firebase.firestore.FieldValue.arrayUnion(user.uid);
        await db.collection('posts').doc(postId).update(updates);
      }
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Não foi possível reagir');
    }
  };

  const handleBookmark = async (postId: string, savedBy: string[] = []) => {
    if (!user) return;
    const alreadySaved = savedBy.includes(user.uid);
    try {
      if (alreadySaved) {
        await db.collection('posts').doc(postId).update({
          savedBy: firebase.firestore.FieldValue.arrayRemove(user.uid),
        });
      } else {
        await db.collection('posts').doc(postId).update({
          savedBy: firebase.firestore.FieldValue.arrayUnion(user.uid),
        });
      }
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Não foi possível salvar');
    }
  };

  const handleDeletePost = (postId: string, mediaUrl?: string, mediaType?: string) => {
    Alert.alert('Apagar post', 'Tem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          try {
            if (mediaUrl) {
              const storagePath = extractStoragePath(mediaUrl);
              await deleteMedia(storagePath);
              const cacheDir = new Directory(Paths.cache, 'rilaxy-decrypted');
              const ext = mediaType?.startsWith('video/') ? 'mp4' : 'jpg';
              const cacheFile = new File(cacheDir, `${pathHash(mediaUrl)}.${ext}`);
              if (cacheFile.exists) cacheFile.delete();
            }
            await db.collection('posts').doc(postId).delete();
          } catch (e: any) {
            Alert.alert('Erro', e?.message || 'Não foi possível apagar');
          }
        },
      },
    ]);
  };

  const handleComment = async (postId: string) => {
    const text = commentText[postId]?.trim();
    if (!text || !user) return;
    try {
      await db.collection('posts').doc(postId).collection('comments').add({
        text,
        senderId: user.uid,
        senderName: user.displayName || 'Anônimo',
        timestamp: new Date(),
      });
      await db.collection('posts').doc(postId).update({
        commentsCount: firebase.firestore.FieldValue.increment(1),
      });
      setCommentText((prev) => ({ ...prev, [postId]: '' }));
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Não foi possível comentar');
    }
  };

  const handleEditPost = (post: Post) => {
    setEditingPost(post);
    setEditText(post.text || '');
  };

  const handleSaveEdit = async () => {
    if (!editingPost) return;
    const trimmed = editText.trim();
    setEditSaving(true);
    try {
      await db.collection('posts').doc(editingPost.id).update({ text: trimmed });
      setEditingPost(null);
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Não foi possível editar');
    } finally {
      setEditSaving(false);
    }
  };

  const handleSharePost = async (post: Post) => {
    setSharingPost(post);
    setShareLoading(true);
    try {
      const snap = await db.collection('chats')
        .where('participants', 'array-contains', user!.uid)
        .orderBy('lastMessageTime', 'desc')
        .get();
      const chats = snap.docs.map((d) => {
        const data = d.data();
        const otherUid = data.participants.find((p: string) => p !== user!.uid);
        return { id: d.id, name: data.name || otherUid || 'Chat' };
      });
      setShareChats(chats);
    } catch {
      setShareChats([]);
    } finally {
      setShareLoading(false);
    }
  };

  const executeSharePost = async (targetChatId: string) => {
    if (!sharingPost || !user) return;
    try {
      const mediaUri = decryptedUris[sharingPost.id]?.[0] || sharingPost.mediaUrl || sharingPost.mediaUrls?.[0] || null;
      await db.collection('chats').doc(targetChatId).collection('messages').add({
        text: sharingPost.text || '',
        mediaUrl: mediaUri,
        mediaType: sharingPost.mediaType || null,
        senderId: user.uid,
        senderName: user.displayName || 'Usuário',
        participants: [],
        readBy: [user.uid],
        timestamp: new Date(),
        sharedPost: {
          postId: sharingPost.id,
          senderName: sharingPost.senderName,
          text: sharingPost.text || '',
          mediaType: sharingPost.mediaType || null,
        },
      });
      await db.collection('chats').doc(targetChatId).update({ lastMessageTime: new Date() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('Enviado', 'Post compartilhado no chat!');
    } catch {
      Alert.alert('Erro', 'Não foi possível compartilhar');
    }
    setSharingPost(null);
    setShareChats([]);
  };

  const handlePressHashtag = (tag: string) => {
    Alert.alert('Busca', `Busca por #${tag} será implementada em breve`);
  };

  const handlePressMention = (displayName: string) => {
    db.collection('users').where('displayName', '==', displayName).limit(1).get()
      .then((snap) => {
        if (!snap.empty) {
          const uid = snap.docs[0].id;
          navigation.navigate('UserProfile', { userId: uid });
        }
      })
      .catch(() => {});
  };

  const handleMuteUser = async (targetUid: string, targetName: string) => {
    if (!user) return;
    Alert.alert('Silenciar ' + targetName, 'Você não verá mais posts dessa pessoa no feed.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Silenciar',
        style: 'destructive',
        onPress: async () => {
          try {
            await muteUser(user.uid, targetUid);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          } catch (e: any) {
            Alert.alert('Erro', e?.message || 'Não foi possível silenciar');
          }
        },
      },
    ]);
  };

  const handleReport = async () => {
    if (!user || !reportPostData || !selectedReason) return;
    setReportSending(true);
    try {
      await reportPost(
        reportPostData.id,
        reportPostData.senderId,
        user.uid,
        user.displayName || 'Usuário',
        selectedReason,
        reportPostData.text,
        reportPostData.mediaUrl,
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('Obrigado', 'Seu report foi enviado e será analisado.');
      setReportModalVisible(false);
      setSelectedReason('');
      setReportPostData(null);
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Não foi possível enviar o report');
    } finally {
      setReportSending(false);
    }
  };

  const renderPostItem: ListRenderItem<Post> = useCallback(({ item }) => (
    <PostItem
      item={item}
      currentUserId={user?.uid}
      decryptedUris={decryptedUris}
      commentText={commentText}
      isVisible={visiblePostIds.has(item.id)}
      onLike={handleLike}
      onReact={handleReact}
      onBookmark={handleBookmark}
      onDeletePost={handleDeletePost}
      onEditPost={handleEditPost}
      onSharePost={handleSharePost}
      onComment={handleComment}
      onCommentTextChange={(id, t) => setCommentText((prev) => ({ ...prev, [id]: t }))}
      onSelectMedia={setSelectedMediaUri}
      onSelectVideo={setSelectedVideoUri}
      onSelectComments={setSelectedPostForComments}
      onPressHashtag={handlePressHashtag}
      onPressMention={handlePressMention}
      onMuteUser={handleMuteUser}
    />
  ), [user, decryptedUris, commentText, visiblePostIds]);

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        <Animated.View
          style={[
            styles.tabIndicator,
            {
              transform: [{
                translateX: tabIndicatorX.interpolate({
                  inputRange: [0, SCREEN_W / 3, (SCREEN_W / 3) * 2],
                  outputRange: [SCREEN_W / 6 - 20, SCREEN_W / 2 - 20, (SCREEN_W / 6) * 5 - 20],
                }),
              }],
            },
          ]}
        />
        {(Object.keys(TAB_LABELS) as FeedTab[]).map((tab) => (
          <Pressable
            key={tab}
            style={styles.tab}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setActiveTab(tab);
            }}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {TAB_LABELS[tab]}
            </Text>
          </Pressable>
        ))}
      </View>

      <StoriesRow
        onPressMyStory={() => navigation.navigate('CreateStory')}
        onPressStory={(groups, idx) => {
          setStoryGroups(groups);
          setStoryViewerIndex(idx);
        }}
      />

      <FlatList
        data={filteredPosts}
        keyExtractor={(item) => item.id}
        renderItem={renderPostItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        contentContainerStyle={[styles.list, loading && styles.listCenter]}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={handleViewableItemsChanged}
        ListEmptyComponent={
          loading ? (
            <>
              <SkeletonPost />
              <SkeletonPost />
              <SkeletonPost />
            </>
          ) : error ? (
            <View style={styles.center}>
              <Ionicons name="cloud-offline-outline" size={48} color={colors.textMuted} />
              <Text style={styles.errorText}>{error}</Text>
              <Pressable onPress={onRefresh} style={styles.retryButton}>
                <Text style={styles.retryText}>Tentar novamente</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <Ionicons
                  name={activeTab === 'following' ? 'people-outline' : activeTab === 'favorites' ? 'bookmark-outline' : 'newspaper-outline'}
                  size={40}
                  color={colors.accent}
                />
              </View>
              <Text style={styles.emptyTitle}>
                {activeTab === 'following'
                  ? 'Nenhum post de quem você segue'
                  : activeTab === 'favorites'
                  ? 'Nenhum post salvo'
                  : 'Seu feed está vazio'}
              </Text>
              <Text style={styles.emptySubtext}>
                {activeTab === 'forYou'
                  ? 'Crie o primeiro post ou siga pessoas para ver conteúdo aqui.'
                  : activeTab === 'following'
                  ? 'Comece conversando com alguém para ver posts aqui.'
                  : 'Salve posts interessantes para encontrá-los facilmente.'}
              </Text>
              {activeTab === 'forYou' && (
                <Pressable style={styles.emptyCTA} onPress={() => navigation.navigate('CreatePost')}>
                  <Ionicons name="create-outline" size={18} color={colors.white} />
                  <Text style={styles.emptyCTAText}>Criar post</Text>
                </Pressable>
              )}
            </View>
          )
        }
      />

      <StoryViewer
        visible={storyViewerIndex !== null}
        groups={storyGroups}
        startIndex={storyViewerIndex ?? 0}
        onClose={() => setStoryViewerIndex(null)}
      />
      <CommentsModal
        visible={selectedPostForComments !== null}
        postId={selectedPostForComments || ''}
        onClose={() => setSelectedPostForComments(null)}
      />
      <MediaViewer
        visible={selectedMediaUri !== null}
        uri={selectedMediaUri}
        onClose={() => setSelectedMediaUri(null)}
      />
      <VideoPlayer
        visible={selectedVideoUri !== null}
        uri={selectedVideoUri}
        onClose={() => setSelectedVideoUri(null)}
      />

      <Modal visible={editingPost !== null} transparent animationType="slide" onRequestClose={() => setEditingPost(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.editModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar post</Text>
              <Pressable onPress={() => setEditingPost(null)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            <TextInput
              style={styles.editInput}
              placeholder="Texto do post..."
              placeholderTextColor={colors.textMuted}
              value={editText}
              onChangeText={setEditText}
              multiline
              autoFocus
            />
            <Pressable
              style={[styles.saveBtn, editSaving && styles.saveBtnDisabled]}
              onPress={handleSaveEdit}
              disabled={editSaving}
            >
              <Text style={styles.saveBtnText}>{editSaving ? 'Salvando...' : 'Salvar'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={sharingPost !== null} transparent animationType="slide" onRequestClose={() => setSharingPost(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.shareModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Compartilhar no chat</Text>
              <Pressable onPress={() => setSharingPost(null)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            {shareLoading ? (
              <View style={styles.shareEmpty}>
                <Ionicons name="hourglass-outline" size={32} color={colors.textMuted} />
              </View>
            ) : shareChats.length === 0 ? (
              <View style={styles.shareEmpty}>
                <Ionicons name="chatbubbles-outline" size={32} color={colors.textMuted} />
                <Text style={styles.shareEmptyText}>Nenhum chat encontrado</Text>
              </View>
            ) : (
              <FlatList
                data={shareChats}
                keyExtractor={(c) => c.id}
                renderItem={({ item: chat }) => (
                  <Pressable style={({ pressed }) => [styles.shareChatItem, pressed && { backgroundColor: colors.glassHighlight }]} onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                    executeSharePost(chat.id);
                  }}>
                    <View style={styles.shareChatAvatar}>
                      <Text style={styles.shareChatAvatarText}>{chat.name[0]?.toUpperCase() || '?'}</Text>
                    </View>
                    <Text style={styles.shareChatName} numberOfLines={1}>{chat.name}</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </Pressable>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingHorizontal: 4,
    position: 'relative',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 40,
    height: 2,
    backgroundColor: colors.accent,
    borderRadius: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  tabTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  list: {
    paddingTop: 4,
  },
  postCard: {
    backgroundColor: colors.surface,
    marginBottom: 8,
    marginHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  postHeaderInfo: {
    flex: 1,
    marginLeft: 10,
  },
  senderName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  timeAgo: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  postHeaderActions: {
    flexDirection: 'row',
    gap: 14,
  },
  postMedia: {
    width: '100%',
    aspectRatio: 1,
  },
  carouselMedia: {
    width: SCREEN_W,
    aspectRatio: 1,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
    marginHorizontal: 3,
  },
  heartOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  postText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  hashtag: {
    color: colors.accent,
    fontWeight: '600',
  },
  mention: {
    color: colors.accent,
    fontWeight: '600',
  },
  reactionsSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 8,
    gap: 4,
  },
  reactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.elevated,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 2,
  },
  reactionBadgeEmoji: {
    fontSize: 12,
  },
  reactionBadgeCount: {
    color: colors.textMuted,
    fontSize: 11,
  },
  reactionTotal: {
    color: colors.textMuted,
    fontSize: 12,
    marginLeft: 4,
  },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 18,
    position: 'relative',
  },
  actionButtonRight: {
    marginLeft: 'auto',
  },
  actionCount: {
    color: colors.textMuted,
    fontSize: 12,
    marginLeft: 5,
  },
  userReactionBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: colors.elevated,
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userReactionEmoji: {
    fontSize: 9,
  },
  reactionPickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  reactionPicker: {
    position: 'absolute',
    bottom: 60,
    left: 14,
    flexDirection: 'row',
    backgroundColor: colors.elevated,
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  reactionEmojiBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  reactionEmoji: {
    fontSize: 24,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 12,
    gap: 8,
  },
  commentInput: {
    flex: 1,
    backgroundColor: colors.elevated,
    color: colors.text,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 7,
    fontSize: 13,
  },
  listCenter: {
    flex: 1,
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 8,
  },
  errorText: {
    color: colors.destructive,
    fontSize: 15,
    marginTop: 12,
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.elevated,
    borderRadius: 8,
  },
  retryText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accent + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtext: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: colors.accentDark,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  emptyCTAText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  skeletonCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.elevated,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.elevated,
  },
  skeletonMedia: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.elevated,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  editModal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: 'bold',
  },
  editInput: {
    backgroundColor: colors.elevated,
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  saveBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: colors.bg,
    fontSize: 16,
    fontWeight: 'bold',
  },
  shareModal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
    paddingBottom: 16,
  },
  shareEmpty: {
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  shareEmptyText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  shareChatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  shareChatAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareChatAvatarText: {
    color: colors.bg,
    fontSize: 16,
    fontWeight: 'bold',
  },
  shareChatName: {
    color: colors.text,
    fontSize: 15,
    flex: 1,
  },
});
