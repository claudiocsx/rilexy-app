import { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../services/firebase';
import { getColors } from '../theme/colors';
import { useSettingsStore } from '../store/settingsStore';
import MediaViewer from '../components/MediaViewer';
import EmptyState from '../components/EmptyState';

const SCREEN_W = Dimensions.get('window').width;
const NUM_COLUMNS = 3;
const ITEM_SIZE = (SCREEN_W - 32 - (NUM_COLUMNS - 1) * 4) / NUM_COLUMNS;

interface MediaItem {
  id: string;
  mediaUrl: string;
  mediaType?: string;
  timestamp: any;
}

import { useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';

type GroupMediaRoute = RouteProp<RootStackParamList, 'GroupMedia'>;

export default function GroupMediaScreen() {
  const route = useRoute<GroupMediaRoute>();
  const { chatId } = route.params;
  const theme = useSettingsStore((s) => s.theme);
  const c = getColors(theme);
  const styles = useMemo(() => getStyles(c), [c]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  useEffect(() => {
    return db.collection('chats').doc(chatId).collection('messages')
      .where('mediaUrl', '>=', '')
      .where('mediaUrl', '!=', '__uploading__')
      .orderBy('timestamp', 'desc')
      .onSnapshot((snap) => {
        const items: MediaItem[] = [];
        snap.forEach((doc) => {
          const d = doc.data();
          if (d.mediaUrl && d.mediaUrl !== '__uploading__' && !d.deletedForEveryone) {
            items.push({
              id: doc.id,
              mediaUrl: d.mediaUrl,
              mediaType: d.mediaType || 'image',
              timestamp: d.timestamp,
            });
          }
        });
        setMedia(items);
        setLoading(false);
      });
  }, [chatId]);

  const renderItem = useCallback(({ item }: { item: MediaItem }) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => setViewerUri(item.mediaUrl)}
      activeOpacity={0.7}
    >
      <Image
        source={item.mediaUrl}
        style={styles.image}
        contentFit="cover"
        transition={200}
      />
      {item.mediaType === 'video' && (
        <View style={styles.videoBadge}>
          <Ionicons name="play" size={16} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  ), []);

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.empty}>
          <ActivityIndicator size="large" color={c.accent} />
        </View>
      ) : media.length === 0 ? (
        <EmptyState icon="images-outline" title="Nenhuma mídia compartilhada" subtitle="Fotos e vídeos do grupo aparecerão aqui" />
      
      ) : (
        <FlatList
          data={media}
          keyExtractor={(item) => item.id}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={styles.grid}
          renderItem={renderItem}
        />
      )}
      <MediaViewer visible={!!viewerUri} uri={viewerUri} onClose={() => setViewerUri(null)} />
    </View>
  );
}

function getStyles(c: ReturnType<typeof getColors>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.bg,
    },
    grid: {
      padding: 12,
      gap: 4,
    },
    item: {
      width: ITEM_SIZE,
      height: ITEM_SIZE,
      margin: 2,
      borderRadius: 8,
      overflow: 'hidden',
    },
    image: {
      width: '100%',
      height: '100%',
    },
    videoBadge: {
      position: 'absolute',
      top: 4,
      right: 4,
      backgroundColor: 'rgba(0,0,0,0.6)',
      borderRadius: 12,
      width: 24,
      height: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    empty: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
    },
    emptyText: {
      color: c.textMuted,
      fontSize: 16,
    },
  });
}
