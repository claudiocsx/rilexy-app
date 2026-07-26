import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import firebase from 'firebase/compat/app';
import { Ionicons } from '@expo/vector-icons';
import { getColors } from '../theme/colors';
import { useSettingsStore } from '../store/settingsStore';

interface PollData {
  question: string;
  options: { text: string; votes: string[] }[];
  totalVotes: number;
}

interface PollMessageProps {
  poll: PollData;
  messageId: string;
  chatId: string;
  userId: string;
  isMine: boolean;
}

function PollMessage({ poll, messageId, chatId, userId, isMine }: PollMessageProps) {
  const theme = useSettingsStore((s) => s.theme);
  const c = getColors(theme);
  const [voting, setVoting] = useState(false);
  if (!poll?.question || !Array.isArray(poll.options)) return null;
  const hasVoted = poll.options.some((o) => Array.isArray(o?.votes) && o.votes.includes(userId));

  const handleVote = useCallback(async (index: number) => {
    if (voting || hasVoted) return;
    setVoting(true);
    try {
      const db = firebase.firestore();
      await db.collection('chats').doc(chatId).collection('messages').doc(messageId).update({
        [`poll.options.${index}.votes`]: firebase.firestore.FieldValue.arrayUnion(userId),
        [`poll.totalVotes`]: firebase.firestore.FieldValue.increment(1),
      });
    } catch {
    } finally {
      setVoting(false);
    }
  }, [voting, hasVoted, chatId, messageId, userId]);

  return (
    <View style={{ borderWidth: 1, borderColor: c.borderLight, borderRadius: 8, padding: 8, marginBottom: 4, minWidth: 220 }}>
      <Text style={{ color: c.text, fontSize: 15, fontWeight: '600', marginBottom: 6 }}>{poll.question}</Text>
      {poll.options.map((opt, i) => {
        const pct = poll.totalVotes > 0 ? Math.round((opt.votes.length / poll.totalVotes) * 100) : 0;
        return (
          <TouchableOpacity
            key={i}
            style={[
              {
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 8,
                paddingHorizontal: 8,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: c.borderLight,
                marginBottom: 4,
                overflow: 'hidden',
                position: 'relative',
              },
              hasVoted && { borderWidth: 1 },
            ]}
            onPress={() => handleVote(i)}
            disabled={voting || hasVoted}
            activeOpacity={0.7}
          >
            <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, backgroundColor: c.accent, opacity: 0.15, borderRadius: 6 }} />
            <View style={{ flexDirection: 'row', flex: 1, justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: c.text, fontSize: 14, flex: 1 }}>{opt.text}</Text>
              {hasVoted && (
                <Text style={{ color: c.textMuted, fontSize: 13, fontWeight: '500', marginLeft: 8 }}>{pct}%</Text>
              )}
            </View>
            {hasVoted && opt.votes.includes(userId) && (
              <Ionicons name="checkmark-circle" size={16} color={c.accent} style={{ marginLeft: 4 }} />
            )}
          </TouchableOpacity>
        );
      })}
      <Text style={{ color: c.textMuted, fontSize: 11, marginTop: 4 }}>
        {poll.totalVotes} {poll.totalVotes === 1 ? 'voto' : 'votos'}
      </Text>
    </View>
  );
}

export default PollMessage;
