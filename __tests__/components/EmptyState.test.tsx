import { render, screen } from '@testing-library/react-native';
import EmptyState from '../../src/components/EmptyState';

describe('EmptyState', () => {
  it('renders title and subtitle', async () => {
    await render(<EmptyState icon="chatbubbles-outline" title="Nenhuma conversa" subtitle="Inicie uma nova conversa" />);
    expect(screen.getByText('Nenhuma conversa')).toBeTruthy();
    expect(screen.getByText('Inicie uma nova conversa')).toBeTruthy();
  });

  it('renders action button when actionLabel and onAction provided', async () => {
    const onAction = jest.fn();
    await render(<EmptyState icon="chatbubbles-outline" title="Vazio" actionLabel="Criar" onAction={onAction} />);
    const button = screen.getByText('Criar');
    expect(button).toBeTruthy();
  });

  it('does not render action button when onAction is missing', async () => {
    await render(<EmptyState icon="chatbubbles-outline" title="Vazio" actionLabel="Criar" />);
    expect(screen.queryByText('Criar')).toBeNull();
  });

  it('does not render action button when actionLabel is missing', async () => {
    await render(<EmptyState icon="chatbubbles-outline" title="Vazio" onAction={jest.fn()} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders action icon when provided', async () => {
    await render(<EmptyState icon="chatbubbles-outline" title="Vazio" actionLabel="Criar" actionIcon="add" onAction={jest.fn()} />);
    expect(screen.getByTestId('icon-add')).toBeTruthy();
  });

  it('renders subtitle only when provided', async () => {
    const { rerender } = await render(<EmptyState icon="chatbubbles-outline" title="Vazio" />);
    expect(screen.queryByText('Subtítulo')).toBeNull();

    rerender(<EmptyState icon="chatbubbles-outline" title="Vazio" subtitle="Subtítulo" />);
    expect(screen.getByText('Subtítulo')).toBeTruthy();
  });

  it('calls onAction when button pressed', async () => {
    const onAction = jest.fn();
    await render(<EmptyState icon="chatbubbles-outline" title="Vazio" actionLabel="Criar" onAction={onAction} />);
    screen.getByText('Criar').parent?.props?.onPress();
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
