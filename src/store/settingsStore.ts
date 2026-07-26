import { create } from 'zustand';
import { type Theme } from '../theme/colors';

export type AutoDownload = 'always' | 'wifi' | 'never';

export interface VideoStickerMeta {
  id: string;
  emoji: string;
  name: string;
  videoUrl: string;
  trimStart?: number;
  trimEnd?: number;
}

interface SettingsState {
  autoDownload: AutoDownload;
  setAutoDownload: (value: AutoDownload) => void;
  stickerUsage: Record<string, number>;
  incrementStickerUsage: (stickerId: string) => void;
  getFavoriteStickers: () => string[];
  favoriteStickers: string[];
  addFavoriteSticker: (stickerId: string) => Promise<void>;
  removeFavoriteSticker: (stickerId: string) => Promise<void>;
  isFavoriteSticker: (stickerId: string) => boolean;
  theme: Theme;
  toggleTheme: () => void;
  videoStickers: VideoStickerMeta[];
  addVideoSticker: (meta: VideoStickerMeta) => Promise<void>;
  removeVideoSticker: (id: string) => Promise<void>;
  loadVideoStickers: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  autoDownload: 'wifi',
  setAutoDownload: (value) => set({ autoDownload: value }),
  stickerUsage: {},
  incrementStickerUsage: (stickerId) =>
    set((state) => ({
      stickerUsage: {
        ...state.stickerUsage,
        [stickerId]: (state.stickerUsage[stickerId] || 0) + 1,
      },
    })),
  getFavoriteStickers: () => {
    const state = get();
    const usageIds = Object.entries(state.stickerUsage)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([id]) => id);
    const all = [...new Set([...state.favoriteStickers, ...usageIds])];
    return all.slice(0, 12);
  },
  favoriteStickers: [],
  addFavoriteSticker: async (stickerId) => {
    const list = [...new Set([...get().favoriteStickers, stickerId])];
    await saveFavorites(list);
    set({ favoriteStickers: list });
  },
  removeFavoriteSticker: async (stickerId) => {
    const list = get().favoriteStickers.filter((id) => id !== stickerId);
    await saveFavorites(list);
    set({ favoriteStickers: list });
  },
  isFavoriteSticker: (stickerId) => get().favoriteStickers.includes(stickerId),
  theme: 'dark',
  toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
  videoStickers: [],
  addVideoSticker: async (meta) => {
    const list = [...get().videoStickers, meta];
    await saveIndex(list);
    set({ videoStickers: list });
  },
  removeVideoSticker: async (id) => {
    const list = get().videoStickers.filter((s) => s.id !== id);
    await saveIndex(list);
    const { File } = require('expo-file-system');
    const dir = await getStickersDir();
    const file = new File(dir, id + '.mp4');
    if (file.exists) await file.delete();
    set({ videoStickers: list });
  },
  loadVideoStickers: async () => {
    try {
      const list = await readIndex();
      const favs = await readFavorites();
      set({ videoStickers: list, favoriteStickers: favs });
    } catch {
      set({ videoStickers: [], favoriteStickers: [] });
    }
  },
}));

let stickersDir: any = null;
let indexFile: any = null;
let favoritesFile: any = null;

async function ensureInit() {
  if (stickersDir) return;
  const { File, Directory, Paths } = require('expo-file-system');
  stickersDir = new Directory(Paths.document, 'rilaxy-stickers');
  indexFile = new File(stickersDir, 'index.json');
  favoritesFile = new File(stickersDir, 'favorites.json');
}

async function getStickersDir() {
  await ensureInit();
  return stickersDir;
}

async function saveIndex(metaList: VideoStickerMeta[]) {
  await ensureInit();
  await stickersDir.create({ intermediates: true, idempotent: true });
  await indexFile.write(JSON.stringify(metaList));
}

async function readIndex(): Promise<VideoStickerMeta[]> {
  await ensureInit();
  if (!indexFile.exists) return [];
  const text = await indexFile.text();
  return JSON.parse(text);
}

async function saveFavorites(ids: string[]) {
  await ensureInit();
  await stickersDir.create({ intermediates: true, idempotent: true });
  await favoritesFile.write(JSON.stringify(ids));
}

async function readFavorites(): Promise<string[]> {
  await ensureInit();
  if (!favoritesFile.exists) return [];
  const text = await favoritesFile.text();
  return JSON.parse(text);
}
