import { create } from 'zustand';

export type AutoDownload = 'always' | 'wifi' | 'never';

interface SettingsState {
  autoDownload: AutoDownload;
  setAutoDownload: (value: AutoDownload) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  autoDownload: 'wifi',
  setAutoDownload: (value) => set({ autoDownload: value }),
}));
