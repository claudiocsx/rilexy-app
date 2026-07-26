import { render, screen, act, fireEvent } from '@testing-library/react-native';
import { ToastProvider, useToast } from '../../src/components/Toast';
import { Text, TouchableOpacity } from 'react-native';

function TriggerButton({ message, type }: { message: string; type?: 'success' | 'error' | 'info' }) {
  const { showToast } = useToast();
  return (
    <TouchableOpacity onPress={() => showToast(message, type)}>
      <Text>Show Toast</Text>
    </TouchableOpacity>
  );
}

describe('Toast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders children', async () => {
    await render(
      <ToastProvider>
        <Text>App Content</Text>
      </ToastProvider>
    );
    expect(screen.getByText('App Content')).toBeTruthy();
  });

  it('shows toast message when showToast is called', async () => {
    await render(
      <ToastProvider>
        <TriggerButton message="Test toast" />
      </ToastProvider>
    );
    fireEvent.press(screen.getByText('Show Toast'));
    expect(screen.getByText('Test toast')).toBeTruthy();
  });

  it('shows multiple toasts', async () => {
    await render(
      <ToastProvider>
        <>
          <TriggerButton message="Toast 1" />
          <TriggerButton message="Toast 2" />
        </>
      </ToastProvider>
    );
    fireEvent.press(screen.getAllByText('Show Toast')[0]);
    fireEvent.press(screen.getAllByText('Show Toast')[1]);
    expect(screen.getByText('Toast 1')).toBeTruthy();
    expect(screen.getByText('Toast 2')).toBeTruthy();
  });

  it('removes toast after timeout', async () => {
    await render(
      <ToastProvider>
        <TriggerButton message="Auto dismiss" />
      </ToastProvider>
    );
    fireEvent.press(screen.getByText('Show Toast'));
    expect(screen.getByText('Auto dismiss')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(3000);
    });
    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(screen.queryByText('Auto dismiss')).toBeNull();
  });

  it('uses default type "info" when not specified', async () => {
    await render(
      <ToastProvider>
        <TriggerButton message="Default info" />
      </ToastProvider>
    );
    fireEvent.press(screen.getByText('Show Toast'));
    expect(screen.getByText('Default info')).toBeTruthy();
  });

  it('throws error when useToast is called outside provider', async () => {
    function TestComponent() {
      useToast();
      return <Text>Should not render</Text>;
    }
    await expect(async () => {
      await render(<TestComponent />);
    }).rejects.toThrow();
  });
});
