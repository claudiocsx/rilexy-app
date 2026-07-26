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
  glassBg: 'rgba(15, 23, 42, 0.85)',
  glassBorder: 'rgba(167, 139, 250, 0.15)',
  glassHighlight: 'rgba(167, 139, 250, 0.08)',
  success: '#22c55e',
  warning: '#f59e0b',
  info: '#3b82f6',
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
  glassBg: 'rgba(255, 255, 255, 0.85)',
  glassBorder: 'rgba(124, 58, 237, 0.15)',
  glassHighlight: 'rgba(124, 58, 237, 0.08)',
  success: '#16a34a',
  warning: '#d97706',
  info: '#2563eb',
};

export function getColors(theme: Theme = 'dark') {
  return theme === 'light' ? lightColors : darkColors;
}

export const colors = getColors('dark');
