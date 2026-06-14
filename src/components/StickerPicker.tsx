import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, ScrollView } from 'react-native';
import LottieView from 'lottie-react-native';
import { STICKER_PACKS, getAllStickers, Sticker } from '../data/stickers';
import { useSettingsStore } from '../store/settingsStore';
import { colors } from '../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STICKER_SIZE = (SCREEN_WIDTH - 48) / 4;

interface Props {
  onSelect: (sticker: Sticker) => void;
  onClose: () => void;
}

export default function StickerPicker({ onSelect, onClose }: Props) {
  const favoriteIds = useSettingsStore((s) => s.getFavoriteStickers());
  const allPacks = STICKER_PACKS;

  const favoriteStickers = favoriteIds
    .map((id) => getAllStickers().find((s) => s.id === id))
    .filter(Boolean) as Sticker[];

  const hasFavorites = favoriteStickers.length > 0;
  const packs = hasFavorites
    ? [{ id: 'favorites', name: 'Favoritos', icon: '⭐', stickers: favoriteStickers }, ...allPacks]
    : allPacks;

  const [activePack, setActivePack] = useState(packs[0].id);
  const pack = packs.find((p) => p.id === activePack) || packs[0];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Figurinhas</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeBtn}>✕</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.tabs}>
        {packs.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={[styles.tab, activePack === p.id && styles.tabActive]}
            onPress={() => setActivePack(p.id)}
          >
            <Text style={styles.tabIcon}>{p.icon}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={styles.pickerScroll}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          if (packs[idx]) setActivePack(packs[idx].id);
        }}
      >
        <View style={styles.grid}>
          {pack.stickers.map((sticker) => (
            <TouchableOpacity
              key={sticker.id}
              style={styles.stickerItem}
              onPress={() => onSelect(sticker)}
              activeOpacity={0.7}
            >
              <LottieView
                source={{ uri: sticker.lottieUrl }}
                style={styles.lottie}
                autoPlay
                loop
                resizeMode="contain"
              />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.elevated,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: 'bold',
  },
  closeBtn: {
    color: colors.textMuted,
    fontSize: 18,
    padding: 4,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  tabActive: {
    backgroundColor: colors.accentDark,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  tabIcon: {
    fontSize: 20,
  },
  pickerScroll: {
    maxHeight: STICKER_SIZE + 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    width: SCREEN_WIDTH,
  },
  stickerItem: {
    width: STICKER_SIZE,
    height: STICKER_SIZE,
    padding: 6,
  },
  lottie: {
    width: '100%',
    height: '100%',
  },
});
