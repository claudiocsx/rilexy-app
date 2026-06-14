import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import AvatarImage from '../components/AvatarImage';
import { db } from '../services/firebase';
import firebase from 'firebase/compat/app';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import StoriesRow from '../components/StoriesRow';
import StoryViewer from '../components/StoryViewer';
import CommentsModal from '../components/CommentsModal';
import MediaViewer from '../components/MediaViewer';
import VideoPlayer from '../components/VideoPlayer';
import { StoryGroup } from '../services/stories';
import { decryptAndCache } from '../services/crypto';

interface Post {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  mediaUrl?: string;
  mediaKey?: string;
  mediaIv?: string;
  mediaType?: string;
  timestamp: any;
  likesCount: number;
  commentsCount: number;
  likedBy?: string[];
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
  const [decryptedUris, setDecryptedUris] = useState<Record<string, string>>({});

  useEffect(() => {
    const pending = posts
      .filter((p) => p.mediaUrl && p.mediaKey && p.mediaIv)
      .map((p) =>
        decryptAndCache(p.mediaUrl!, p.mediaKey!, p.mediaIv!, p.mediaType || 'image/jpeg')
          .then((uri) => ({ id: p.id, uri }))
          .catch(() => ({ id: p.id, uri: null }))
      );
    if (pending.length > 0) {
      Promise.all(pending).then((results) => {
        const map: Record<string, string> = {};
        for (const r of results) {
          if (r.uri) map[r.id] = r.uri;
        }
        setDecryptedUris((prev) => ({ ...prev, ...map }));
      });
    }
  }, [posts]);

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

  const handleDeletePost = (postId: string) => {
    Alert.alert('Apagar post', 'Tem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          try {
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

  const renderPost = ({ item }: { item: Post }) => {
    const liked = item.likedBy?.includes(user?.uid || '') ?? false;
    const isEncrypted = !!(item.mediaKey && item.mediaIv);
    const postUri = decryptedUris[item.id] || (!isEncrypted ? item.mediaUrl : null);
    return (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <AvatarImage photoURL={item.senderPhoto} name={item.senderName} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={styles.senderName}>{item.senderName}</Text>
          <Text style={styles.timeAgo}>{formatTimeAgo(item.timestamp)}</Text>
        </View>
        {item.senderId === user?.uid && (
          <TouchableOpacity onPress={() => handleDeletePost(item.id)}>
            <Ionicons name="ellipsis-vertical" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      {postUri ? (
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {
            if (item.mediaType === 'video' || /\.(mp4|mov|webm)$/i.test(postUri)) {
              setSelectedVideoUri(postUri);
            } else {
              setSelectedMediaUri(postUri);
            }
          }}
        >
          <View>
            <Image
              source={postUri}
              style={styles.postMedia}
              contentFit="cover"
              transition={300}
            />
            {(item.mediaType === 'video' || /\.(mp4|mov|webm)$/i.test(postUri)) && (
              <View style={styles.playOverlay}>
                <Ionicons name="play-circle" size={48} color="#fff" />
              </View>
            )}
          </View>
        </TouchableOpacity>
      ) : isEncrypted ? (
        <View style={styles.decryptingContainer}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : null}
      {item.text ? (
        <Text style={styles.postText}>{item.text}</Text>
      ) : null}
      <View style={styles.postActions}>
        <TouchableOpacity style={styles.actionButton} onPress={() => handleLike(item.id, item.likedBy)}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={20} color={liked ? colors.destructive : colors.accent} />
          <Text style={styles.actionCount}>{item.likesCount || 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => setSelectedPostForComments(item.id)}>
          <Ionicons name="chatbubble-outline" size={20} color={colors.textMuted} />
          <Text style={styles.actionCount}>{item.commentsCount || 0}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.commentInputRow}>
        <TextInput
          style={styles.commentInput}
          placeholder="Comentar..."
          placeholderTextColor={colors.textMuted}
          value={commentText[item.id] || ''}
          onChangeText={(t) => setCommentText((prev) => ({ ...prev, [item.id]: t }))}
        />
        <TouchableOpacity onPress={() => handleComment(item.id)} disabled={!commentText[item.id]?.trim()}>
          <Ionicons name="send" size={20} color={colors.accent} />
        </TouchableOpacity>
      </View>
    </View>
    );
  };

  return (
    <View style={styles.container}>
      <StoriesRow
        onPressMyStory={() => navigation.navigate('CreateStory')}
        onPressStory={(groups, idx) => {
          setStoryGroups(groups);
          setStoryViewerIndex(idx);
        }}
      />
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        contentContainerStyle={[styles.list, loading && styles.listCenter]}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={colors.accent} />
          ) : error ? (
            <View style={styles.center}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : (
            <View style={styles.center}>
              <Ionicons name="newspaper-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>Nenhum post ainda</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  list: {
    padding: 0,
  },
  postCard: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  senderName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  timeAgo: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  postMedia: {
    width: '100%',
    aspectRatio: 1,
  },
  playOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  postText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  postActions: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionCount: {
    color: colors.textMuted,
    fontSize: 13,
    marginLeft: 4,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 8,
  },
  commentInput: {
    flex: 1,
    backgroundColor: colors.elevated,
    color: colors.text,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 13,
  },
  listCenter: {
    flex: 1,
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
  },
  errorText: {
    color: colors.destructive,
    fontSize: 15,
    marginTop: 40,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 16,
    marginTop: 12,
    fontWeight: '600',
  },
  decryptingContainer: {
    width: '100%',
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
});
