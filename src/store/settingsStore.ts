import { create } from 'zustand';
import { type Theme } from '../theme/colors';

export type AutoDownload = 'always' | 'wifi' | 'never';

interface SettingsState {
  autoDownload: AutoDownload;
  setAutoDownload: (value: AutoDownload) => void;
  stickerUsage: Record<string, number>;
  incrementStickerUsage: (stickerId: string) => void;
  getFavoriteStickers: () => string[];
  theme: Theme;
  toggleTheme: () => void;
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
    const usage = get().stickerUsage;
    return Object.entries(usage)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([id]) => id);
  },
  theme: 'dark',
  toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
}));
