export type Sticker = {
  id: string;
  emoji: string;
  name: string;
  lottieUrl: string;
};

export type StickerPack = {
  id: string;
  name: string;
  icon: string;
  stickers: Sticker[];
};

const BASE = 'https://kojmnryyhzxuyxarlvse.supabase.co/storage/v1/object/public/rilaxy-media/stickers';

export const STICKER_PACKS: StickerPack[] = [
  {
    id: 'reactions',
    name: 'Reações',
    icon: '😍',
    stickers: [
      { id: 'heart-pulse', emoji: '❤️', name: 'Coração', lottieUrl: `${BASE}/heart-pulse.json` },
      { id: 'purple-pulse', emoji: '💜', name: 'Pulso', lottieUrl: `${BASE}/purple-pulse.json` },
      { id: 'star-twinkle', emoji: '⭐', name: 'Estrela', lottieUrl: `${BASE}/star-twinkle.json` },
    ],
  },
  {
    id: 'celebrations',
    name: 'Festas',
    icon: '🎉',
    stickers: [
      { id: 'confetti-pop', emoji: '🎊', name: 'Confete', lottieUrl: `${BASE}/confetti-pop.json` },
      { id: 'celebration', emoji: '🎉', name: 'Festa', lottieUrl: `${BASE}/celebration.json` },
      { id: 'fire-glow', emoji: '🔥', name: 'Fogo', lottieUrl: `${BASE}/fire-glow.json` },
    ],
  },
];

export const getAllStickers = (): Sticker[] =>
  STICKER_PACKS.flatMap((p) => p.stickers);

export const getStickerById = (id: string): Sticker | undefined =>
  getAllStickers().find((s) => s.id === id);
