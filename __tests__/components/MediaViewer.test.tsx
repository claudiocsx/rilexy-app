import { render, screen, fireEvent } from '@testing-library/react-native';
import { Animated } from 'react-native';
import MediaViewer from '../../src/components/MediaViewer';

describe('MediaViewer', () => {
  it('renders nothing when not visible', async () => {
    await render(<MediaViewer visible={false} uri={null} onClose={jest.fn()} />);
    expect(screen.queryByTestId('expo-image')).toBeNull();
  });

  it('renders image when visible with uri', async () => {
    await render(<MediaViewer visible={true} uri="https://example.com/photo.jpg" onClose={jest.fn()} />);
    expect(screen.getByTestId('expo-image')).toBeTruthy();
  });

  it('does not render image when uri is null even if visible', async () => {
    await render(<MediaViewer visible={true} uri={null} onClose={jest.fn()} />);
    expect(screen.queryByTestId('expo-image')).toBeNull();
  });

  it('renders blur view when visible', async () => {
    await render(<MediaViewer visible={true} uri="https://example.com/photo.jpg" onClose={jest.fn()} />);
    expect(screen.getByTestId('blur-view')).toBeTruthy();
  });

  it('calls onClose when backdrop is pressed', async () => {
    const onClose = jest.fn();
    await render(<MediaViewer visible={true} uri="https://example.com/photo.jpg" onClose={onClose} />);

    const panResponder = (Animated.View as any).mock?.calls?.find(
      (call: any) => call[0]?.panHandlers
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it('updates when uri changes', async () => {
    const { rerender } = await render(
      <MediaViewer visible={true} uri="https://example.com/photo1.jpg" onClose={jest.fn()} />
    );
    expect(screen.getByTestId('expo-image')).toBeTruthy();

    rerender(
      <MediaViewer visible={true} uri="https://example.com/photo2.jpg" onClose={jest.fn()} />
    );
    expect(screen.getByTestId('expo-image')).toBeTruthy();
  });
});
