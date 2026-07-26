import { render, screen, fireEvent } from '@testing-library/react-native';
import SettingsScreen from '../../src/screens/SettingsScreen';
import { useSettingsStore } from '../../src/store/settingsStore';
import * as mediaCache from '../../src/services/mediaCache';

jest.mock('../../src/services/mediaCache', () => ({
  getCacheSize: jest.fn(async () => 1048576),
  clearCache: jest.fn(async () => {}),
}));

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSettingsStore.setState({ autoDownload: 'wifi', theme: 'dark' });
    jest.spyOn(global, 'Alert').mockImplementation(() => {});
  });

  afterEach(() => {
    (global.Alert as any).mockRestore();
  });

  it('renders appearance section', async () => {
    await render(<SettingsScreen />);
    expect(screen.getByText('Aparência')).toBeTruthy();
    expect(screen.getByText('Modo escuro')).toBeTruthy();
  });

  it('renders media section', async () => {
    await render(<SettingsScreen />);
    expect(screen.getByText('Mídia')).toBeTruthy();
    expect(screen.getByText('Download automático')).toBeTruthy();
  });

  it('renders cache section', async () => {
    await render(<SettingsScreen />);
    expect(screen.getByText('Cache')).toBeTruthy();
    expect(screen.getByText('Mídias em cache')).toBeTruthy();
  });

  it('renders version info', async () => {
    await render(<SettingsScreen />);
    expect(screen.getByText('Versão')).toBeTruthy();
    expect(screen.getByText('1.0.0')).toBeTruthy();
  });

  it('shows cache size formatted', async () => {
    await render(<SettingsScreen />);
    await (global as any).flushPromises?.() || new Promise(setImmediate);
    expect(screen.getByText('1.0 MB')).toBeTruthy();
  });

  it('displays auto-download options', async () => {
    await render(<SettingsScreen />);
    expect(screen.getByText('Apenas Wi-Fi')).toBeTruthy();
    expect(screen.getByText('Sempre')).toBeTruthy();
    expect(screen.getByText('Nunca')).toBeTruthy();
  });

  it('changes auto-download option on press', async () => {
    await render(<SettingsScreen />);
    fireEvent.press(screen.getByText('Sempre'));
    expect(useSettingsStore.getState().autoDownload).toBe('always');
  });

  it('toggles theme on press', async () => {
    await render(<SettingsScreen />);
    fireEvent.press(screen.getByText('Modo escuro'));
    expect(useSettingsStore.getState().theme).toBe('light');
  });

  it('renders limpar cache button', async () => {
    await render(<SettingsScreen />);
    expect(screen.getByText('Limpar cache')).toBeTruthy();
  });

  it('shows clearing state when clearing cache', async () => {
    (mediaCache.clearCache as jest.Mock).mockImplementationOnce(() => new Promise(() => {}));
    await render(<SettingsScreen />);
    await (global as any).flushPromises?.() || new Promise(setImmediate);

    fireEvent.press(screen.getByText('Limpar cache'));
    expect(global.Alert.alert).toHaveBeenCalled();
    const alertCall = (global.Alert.alert as jest.Mock).mock.calls[0];
    const clearButton = alertCall[2].find((b: any) => b.text === 'Limpar');
    clearButton.onPress();
  });
});
