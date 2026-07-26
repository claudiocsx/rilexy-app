import { render, screen, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import ErrorBoundary from '../../src/components/ErrorBoundary';

function BuggyComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Test crash');
  return <Text>Funcionando</Text>;
}

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  (console.error as jest.Mock).mockRestore();
});

describe('ErrorBoundary', () => {
  it('renders children when no error occurs', async () => {
    await render(
      <ErrorBoundary>
        <Text>Funcionando</Text>
      </ErrorBoundary>
    );
    expect(screen.getByText('Funcionando')).toBeTruthy();
  });

  it('renders default fallback UI on error', async () => {
    await render(
      <ErrorBoundary>
        <BuggyComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Algo deu errado')).toBeTruthy();
    expect(screen.getByText('Test crash')).toBeTruthy();
    expect(screen.getByText('Tentar novamente')).toBeTruthy();
  });

  it('renders custom fallback when provided', async () => {
    await render(
      <ErrorBoundary fallback={<Text>Custom Error UI</Text>}>
        <BuggyComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Custom Error UI')).toBeTruthy();
    expect(screen.queryByText('Algo deu errado')).toBeNull();
  });

  it('recovers after retry press', async () => {
    const { rerender } = await render(
      <ErrorBoundary>
        <BuggyComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Algo deu errado')).toBeTruthy();

    rerender(
      <ErrorBoundary>
        <BuggyComponent shouldThrow={false} />
      </ErrorBoundary>
    );

    fireEvent.press(screen.getByText('Tentar novamente'));
    expect(screen.getByText('Funcionando')).toBeTruthy();
  });

  it('handles error without message', async () => {
    await render(
      <ErrorBoundary>
        <BuggyComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Test crash')).toBeTruthy();
  });
});
