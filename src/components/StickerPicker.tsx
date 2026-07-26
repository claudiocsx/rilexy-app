import { useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, Dimensions, ScrollView } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import LottieView from 'lottie-react-native';
import { STICKER_PACKS, getAllStickers, Sticker } from '../data/stickers';
import { useSettingsStore } from '../store/settingsStore';
import { getColors } from '../theme/colors';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STICKER_SIZE = (SCREEN_WIDTH - 48) / 4;

interface Props {
  onSelect: (sticker: Sticker) => void;
  onClose: () => void;
  onCreate?: () => void;
}

function VideoStickerItem({ videoUrl, size, trimStart, trimEnd, c }: { videoUrl: string; size: number; trimStart?: number; trimEnd?: number; c: ReturnType<typeof getColors> }) {
  const player = useVideoPlayer({ uri: videoUrl }, (p) => {
    p.loop = true;
    p.muted = true;
    if (trimStart != null) p.currentTime = trimStart;
    p.play();
  });
  const hasTrim = trimStart != null && trimEnd != null;
  return (
    <View style={{ width: size, height: size }}>
      <VideoView
        player={player}
        style={{ width: size, height: size }}
        nativeControls={false}
        contentFit="contain"
      />
      {hasTrim && (
        <View style={{ position: 'absolute', top: 2, right: 2, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8, width: 18, height: 18, justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="cut-outline" size={12} color={c.white} />
        </View>
      )}
    </View>
  );
}

function StickerItem({ sticker, onPress, c }: { sticker: Sticker; onPress: () => void; c: ReturnType<typeof getColors> }) {
  const [failed, setFailed] = useState(false);
  const isFav = useSettingsStore((s) => s.isFavoriteSticker(sticker.id));
  const addFav = useSettingsStore((s) => s.addFavoriteSticker);
  const removeFav = useSettingsStore((s) => s.removeFavoriteSticker);
  const handleStarPress = useCallback(() => {
    if (isFav) {
      removeFav(sticker.id);
    } else {
      addFav(sticker.id);
    }
  }, [isFav, sticker.id, addFav, removeFav]);
  return (
    <View style={{ width: STICKER_SIZE, height: STICKER_SIZE, padding: 6 }}>
      <TouchableOpacity
        style={{ width: '100%', height: '100%', position: 'relative' }}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {failed ? (
          <Text style={{ fontSize: 36, textAlign: 'center', lineHeight: STICKER_SIZE - 12 }}>{sticker.emoji}</Text>
        ) : sticker.videoUrl ? (
          <VideoStickerItem
            videoUrl={sticker.videoUrl}
            size={STICKER_SIZE - 12}
            trimStart={sticker.trimStart}
            trimEnd={sticker.trimEnd}
            c={c}
          />
        ) : (
          <LottieView
            source={{ uri: sticker.lottieUrl }}
            style={{ width: '100%', height: '100%' }}
            autoPlay
            loop
            resizeMode="contain"
            onError={() => setFailed(true)}
          />
        )}
      </TouchableOpacity>
      <TouchableOpacity
        onPress={handleStarPress}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{ position: 'absolute', top: 2, right: 2, width: 22, height: 22, borderRadius: 11, backgroundColor: isFav ? c.accentDark : 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }}
      >
        <Ionicons name={isFav ? 'star' : 'star-outline'} size={12} color={isFav ? '#fff' : c.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

export default function StickerPicker({ onSelect, onClose, onCreate }: Props) {
  const theme = useSettingsStore((s) => s.theme);
  const c = getColors(theme);
  const favoriteIds = useSettingsStore((s) => s.getFavoriteStickers());
  const videoStickers = useSettingsStore((s) => s.videoStickers);
  const allPacks = STICKER_PACKS;

  const favoriteStickers = useMemo(
    () => favoriteIds
      .map((id) => getAllStickers().find((s) => s.id === id))
      .filter(Boolean) as Sticker[],
    [favoriteIds],
  );

  const hasFavorites = favoriteStickers.length > 0;

  const userStickers: Sticker[] = useMemo(
    () => videoStickers.map((vs) => ({
      id: vs.id,
      emoji: vs.emoji,
      name: vs.name,
      lottieUrl: '',
      videoUrl: vs.videoUrl,
      trimStart: vs.trimStart,
      trimEnd: vs.trimEnd,
    })),
    [videoStickers],
  );

  const hasUserStickers = userStickers.length > 0;

  const packs = useMemo(
    () => [
      ...(hasFavorites ? [{ id: 'favorites', name: 'Favoritos', icon: '⭐', stickers: favoriteStickers }] : []),
      ...(hasUserStickers ? [{ id: 'user', name: 'Suas', icon: '🎬', stickers: userStickers }] : []),
      ...allPacks,
    ],
    [hasFavorites, favoriteStickers, hasUserStickers, userStickers],
  );

  const [activePack, setActivePack] = useState(packs[0]?.id || '');
  const pack = packs.find((p) => p.id === activePack) || packs[0];

  if (packs.length === 0) return null;

  return (
    <View style={{ backgroundColor: c.elevated, borderTopWidth: 1, borderTopColor: c.borderLight, paddingBottom: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 }}>
        <Text style={{ color: c.text, fontSize: 15, fontWeight: 'bold' }}>Figurinhas</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close-outline" size={24} color={c.textMuted} />
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 12, marginBottom: 8, alignItems: 'center' }}>
        {packs.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={[
              { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: c.surface },
              activePack === p.id && { backgroundColor: c.accentDark, borderWidth: 1, borderColor: c.accent },
            ]}
            onPress={() => setActivePack(p.id)}
          >
            <Text style={{ fontSize: 20 }}>{p.icon}</Text>
          </TouchableOpacity>
        ))}
        {onCreate && (
          <TouchableOpacity
            style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.accentDark, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: c.accent }}
            onPress={onCreate}
          >
            <Text style={{ color: c.text, fontSize: 18, fontWeight: 'bold', lineHeight: 20 }}>+</Text>
          </TouchableOpacity>
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ maxHeight: STICKER_SIZE + 16 }}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, width: SCREEN_WIDTH }}>
          {pack.stickers.map((sticker) => (
            <StickerItem
              key={sticker.id}
              sticker={sticker}
              onPress={() => onSelect(sticker)}
              c={c}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
