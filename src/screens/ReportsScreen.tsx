import { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { getReports, deletePostAndReport, dismissReport, Report, REPORT_REASONS } from '../services/report';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { colors } from '../theme/colors';

export default function ReportsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [reports, setReports] = useState<Report[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const unsub = db.collection('users').doc(user.uid).onSnapshot((doc) => {
      const data = doc.data();
      setIsAdmin(data?.isAdmin === true || (data?.admins && Array.isArray(data.admins) && data.admins.includes(user.uid)));
    });
    return unsub;
  }, [user?.uid]);

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    loadReports();
  }, [isAdmin]);

  const loadReports = async () => {
    try {
      const r = await getReports();
      setReports(r);
    } catch { /* silence */ }
    setLoading(false);
  };

  const handleDeletePost = (reportId: string, postId: string) => {
    Alert.alert('Deletar post', 'O post será removido permanentemente.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Deletar',
        style: 'destructive',
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          await deletePostAndReport(reportId, postId);
          setReports((prev) => prev.filter((r) => r.id !== reportId));
        },
      },
    ]);
  };

  const handleDismiss = async (reportId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await dismissReport(reportId);
    setReports((prev) => prev.filter((r) => r.id !== reportId));
  };

  const getReasonLabel = (key: string) => REPORT_REASONS.find((r) => r.key === key)?.label || key;

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <View style={styles.empty}>
          <Ionicons name="shield-checkmark-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyText}>Acesso restrito</Text>
          <Text style={styles.emptySubtext}>Apenas administradores podem visualizar reports.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {reports.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="checkmark-circle-outline" size={36} color={colors.accent} />
          </View>
          <Text style={styles.emptyText}>Nenhum report pendente</Text>
          <Text style={styles.emptySubtext}>Todos os posts estão em conformidade.</Text>
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id!}
          renderItem={({ item }) => (
            <View style={[styles.reportCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
              <View style={styles.reportHeader}>
                <Ionicons name="alert-circle-outline" size={20} color={colors.destructive} />
                <Text style={[styles.reasonLabel, { color: colors.text }]}>{getReasonLabel(item.reason)}</Text>
              </View>
              {item.postText ? (
                <Text style={[styles.postPreview, { color: colors.textMuted }]} numberOfLines={2}>"{item.postText}"</Text>
              ) : null}
              <Text style={[styles.reportedBy, { color: colors.textMuted }]}>
                Reportado por: {item.reportedByName}
              </Text>
              <View style={styles.reportActions}>
                <Pressable
                  onPress={() => handleDeletePost(item.id!, item.postId)}
                  style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.destructive + '15', opacity: pressed ? 0.7 : 1 }]}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.destructive} />
                  <Text style={[styles.actionText, { color: colors.destructive }]}>Deletar post</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleDismiss(item.id!)}
                  style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.elevated, opacity: pressed ? 0.7 : 1 }]}
                >
                  <Ionicons name="checkmark-outline" size={16} color={colors.textMuted} />
                  <Text style={[styles.actionText, { color: colors.textMuted }]}>Dispensar</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, gap: 12 },
  emptyIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.accent + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyText: { color: colors.text, fontSize: 17, fontWeight: '600' },
  emptySubtext: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  reportCard: { marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 12, borderWidth: 1 },
  reportHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  reasonLabel: { fontSize: 15, fontWeight: '600', flex: 1 },
  postPreview: { fontSize: 14, fontStyle: 'italic', marginBottom: 8, lineHeight: 20 },
  reportedBy: { fontSize: 13, marginBottom: 12 },
  reportActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  actionText: { fontSize: 13, fontWeight: '600' },
});
