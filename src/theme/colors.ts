export type Theme = 'dark' | 'light';

const darkColors = {
  bg: '#020617',
  surface: '#0f172a',
  elevated: '#1e293b',
  border: '#581c87',
  borderLight: 'rgba(88, 28, 135, 0.3)',
  accent: '#a78bfa',
  accentDark: '#7c3aed',
  accentDeep: '#4c1d95',
  text: '#f1f5f9',
  textMuted: '#94a3b8',
  textSubtle: '#64748b',
  destructive: '#ef4444',
  white: '#ffffff',
  overlay: 'rgba(2, 6, 23, 0.8)',
};

const lightColors = {
  bg: '#f8fafc',
  surface: '#ffffff',
  elevated: '#f1f5f9',
  border: '#c084fc',
  borderLight: 'rgba(192, 132, 252, 0.3)',
  accent: '#7c3aed',
  accentDark: '#6d28d9',
  accentDeep: '#5b21b6',
  text: '#0f172a',
  textMuted: '#475569',
  textSubtle: '#94a3b8',
  destructive: '#dc2626',
  white: '#ffffff',
  overlay: 'rgba(248, 250, 252, 0.8)',
};

export function getColors(theme: Theme = 'dark') {
  return theme === 'light' ? lightColors : darkColors;
}

export const colors = getColors('dark');
