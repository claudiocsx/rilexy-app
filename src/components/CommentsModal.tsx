import { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../services/firebase';
import firebase from 'firebase/compat/app';
import { useAuth } from '../contexts/AuthContext';
import AvatarImage from './AvatarImage';
import { colors } from '../theme/colors';

interface Comment {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  timestamp: any;
}

interface Props {
  visible: boolean;
  postId: string;
  onClose: () => void;
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

export default function CommentsModal({ visible, postId, onClose }: Props) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!visible || !postId) return;
    setLoading(true);
    return db.collection('posts').doc(postId).collection('comments')
      .orderBy('timestamp', 'asc')
      .onSnapshot((snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Comment[];
        setComments(data);
        setLoading(false);
      }, () => {
        setLoading(false);
      });
  }, [visible, postId]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || !user || sending) return;
    setSending(true);
    try {
      await db.collection('posts').doc(postId).collection('comments').add({
        text: trimmed,
        senderId: user.uid,
        senderName: user.displayName || 'Anônimo',
        timestamp: new Date(),
      });
      await db.collection('posts').doc(postId).update({
        commentsCount: firebase.firestore.FieldValue.increment(1),
      });
      setText('');
    } catch (e: any) {
      // silently fail — main feed handles the rule error
    } finally {
      setSending(false);
    }
  };

  const renderComment = ({ item }: { item: Comment }) => (
    <View style={styles.commentRow}>
      <AvatarImage name={item.senderName} size={28} />
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentAuthor}>{item.senderName}</Text>
          <Text style={styles.commentTime}>{formatTimeAgo(item.timestamp)}</Text>
        </View>
        <Text style={styles.commentText}>{item.text}</Text>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Comentários</Text>
          {loading ? (
            <ActivityIndicator size="small" color={colors.accent} style={{ marginTop: 24 }} />
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(item) => item.id}
              renderItem={renderComment}
              contentContainerStyle={styles.list}
              ListEmptyComponent={
                <Text style={styles.empty}>Nenhum comentário ainda</Text>
              }
            />
          )}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Escreva um comentário..."
              placeholderTextColor={colors.textMuted}
              value={text}
              onChangeText={setText}
              multiline={false}
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!text.trim() || sending}
            >
              <Ionicons name="send" size={22} color={text.trim() ? colors.accent : colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 24,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textMuted,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  commentRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 8,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commentAuthor: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  commentTime: {
    color: colors.textMuted,
    fontSize: 11,
  },
  commentText: {
    color: colors.text,
    fontSize: 14,
    marginTop: 2,
    lineHeight: 18,
  },
  empty: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 24,
    fontSize: 14,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  input: {
    flex: 1,
    backgroundColor: colors.elevated,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: colors.text,
    fontSize: 14,
  },
});
