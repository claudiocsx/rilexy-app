import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../services/firebase';
import firebase from 'firebase/compat/app';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import StoriesRow from '../components/StoriesRow';
import StoryViewer from '../components/StoryViewer';
import { StoryGroup } from '../services/stories';

interface Post {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  mediaUrl?: string;
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
    return (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(item.senderName || '?')[0].toUpperCase()}
          </Text>
        </View>
        <View>
          <Text style={styles.senderName}>{item.senderName}</Text>
          <Text style={styles.timeAgo}>{formatTimeAgo(item.timestamp)}</Text>
        </View>
      </View>
      {item.mediaUrl ? (
        <View style={styles.mediaContainer}>
          <Image
            source={{ uri: item.mediaUrl }}
            style={styles.postMedia}
            resizeMode="cover"
          />
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
        <TouchableOpacity style={styles.actionButton}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  list: {
    padding: 12,
  },
  postCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  avatarText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: 'bold',
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
  mediaContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  postMedia: {
    width: '100%',
    height: 192,
  },
  postText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 8,
  },
  postActions: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
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
    marginTop: 8,
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
});
