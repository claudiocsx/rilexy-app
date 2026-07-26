import { render, screen, fireEvent } from '@testing-library/react-native';
import MessageBubble, { Message } from '../../src/components/MessageBubble';

const baseMessage: Message = {
  id: 'msg1',
  text: 'Hello World',
  senderId: 'user1',
  senderName: 'User One',
  timestamp: { toDate: () => new Date('2025-01-01T12:00:00') },
  participants: ['user1', 'user2'],
};

const currentUser = { uid: 'user1' };

describe('MessageBubble', () => {
  const defaultProps = {
    user: currentUser,
    chatId: 'chat1',
    uploadingMessages: {} as Record<string, string>,
    cachedUris: {} as Record<string, string>,
    onLongPress: jest.fn(),
    onViewOnceMedia: jest.fn(),
    onReply: jest.fn(),
    onViewMedia: jest.fn(),
    onReact: jest.fn(),
  };

  it('renders text message', async () => {
    await render(<MessageBubble item={baseMessage} {...defaultProps} />);
    expect(screen.getByText('Hello World')).toBeTruthy();
  });

  it('renders "Mensagem apagada" for deleted messages', async () => {
    const deletedMsg = { ...baseMessage, deletedForEveryone: true };
    await render(<MessageBubble item={deletedMsg} {...defaultProps} />);
    expect(screen.getByText('Mensagem apagada')).toBeTruthy();
  });

  it('returns null if message is deleted for current user', async () => {
    const deletedForMe = { ...baseMessage, deletedFor: ['user1'] };
    const { container } = await render(<MessageBubble item={deletedForMe} {...defaultProps} />);
    expect(container.children.length).toBe(0);
  });

  it('renders timestamp', async () => {
    await render(<MessageBubble item={baseMessage} {...defaultProps} />);
    expect(screen.getByText(/12:00/)).toBeTruthy();
  });

  it('renders "Editada" for edited messages', async () => {
    const edited = { ...baseMessage, edited: true };
    await render(<MessageBubble item={edited} {...defaultProps} />);
    expect(screen.getByText('Editada')).toBeTruthy();
  });

  it('renders "Encaminhada" for forwarded messages', async () => {
    const forwarded = { ...baseMessage, forwarded: true };
    await render(<MessageBubble item={forwarded} {...defaultProps} />);
    expect(screen.getByText('Encaminhada')).toBeTruthy();
  });

  it('renders sender name in group chats', async () => {
    await render(<MessageBubble item={baseMessage} {...defaultProps} isGroup={true} />);
    expect(screen.getByText('User One')).toBeTruthy();
  });

  it('renders reply preview when replyTo is present', async () => {
    const withReply = {
      ...baseMessage,
      replyTo: { id: 'orig', text: 'Original message', senderId: 'user2', senderName: 'User Two' },
    };
    await render(<MessageBubble item={withReply} {...defaultProps} />);
    expect(screen.getByText('User Two')).toBeTruthy();
  });

  it('renders view-once placeholder for non-owner', async () => {
    const viewOnce = {
      ...baseMessage,
      senderId: 'user2',
      viewOnce: true,
      mediaUrl: 'https://example.com/secret.jpg',
      mediaType: 'image/jpeg',
    };
    const otherUser = { uid: 'user1' };
    await render(<MessageBubble item={viewOnce} {...defaultProps} user={otherUser} />);
    expect(screen.getByText('Toque para ver')).toBeTruthy();
  });

  it('shows "Aberta" for already-viewed view-once media', async () => {
    const viewedOnce = {
      ...baseMessage,
      senderId: 'user2',
      viewOnce: true,
      mediaUrl: 'https://example.com/secret.jpg',
      viewedOnceBy: ['user1'],
    };
    await render(<MessageBubble item={viewedOnce} {...defaultProps} />);
    expect(screen.getByText('Aberta')).toBeTruthy();
  });

  it('renders visualização única badge for own view-once media', async () => {
    const myViewOnce = {
      ...baseMessage,
      senderId: 'user1',
      mediaUrl: 'https://example.com/img.jpg',
      viewOnce: true,
      mediaType: 'image/jpeg',
    };
    await render(<MessageBubble item={myViewOnce} {...defaultProps} />);
    expect(screen.getByText('Visualização única')).toBeTruthy();
  });

  it('calls onReact on double tap', async () => {
    const onReact = jest.fn();
    await render(<MessageBubble item={baseMessage} {...defaultProps} onReact={onReact} />);
    const pressable = screen.getByText('Hello World').closest('Pressable')?.parent;
    if (pressable) {
      fireEvent.press(pressable);
      fireEvent.press(pressable);
      expect(onReact).toHaveBeenCalledWith('msg1', '❤️', undefined, 'user1');
    }
  });

  it('renders media image when mediaUrl present', async () => {
    const withMedia = {
      ...baseMessage,
      mediaUrl: 'https://example.com/photo.jpg',
      mediaType: 'image/jpeg',
    };
    await render(<MessageBubble item={withMedia} {...defaultProps} />);
    expect(screen.getByTestId('expo-image')).toBeTruthy();
  });

  it('renders sending overlay when uploading', async () => {
    const uploading = {
      ...baseMessage,
      mediaUrl: '__uploading__',
    };
    await render(<MessageBubble item={uploading} {...defaultProps} />);
    expect(screen.getByText('Enviando...')).toBeTruthy();
  });
});
