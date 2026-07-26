import { uploadMedia, uploadEncryptedMedia, uploadChatMedia, uploadPostMedia, uploadStoryMedia, deleteMedia, uploadAvatar } from '../../src/services/storage';

const { getSupabase } = require('../../src/services/supabase');

describe('storage service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadMedia', () => {
    it('uploads file to supabase and returns public URL', async () => {
      const url = await uploadMedia('file://test.jpg', 'chats/abc/msg123.jpg');
      expect(url).toContain('supabase.co');
      expect(url).toContain('rilaxy-media/chats/abc/msg123.jpg');
    });

    it('returns null on upload error', async () => {
      const supabase = getSupabase();
      supabase.storage.from().upload.mockImplementationOnce(async () => ({ error: new Error('Upload failed') }));
      const result = await uploadMedia('file://test.jpg', 'chats/abc/msg123.jpg');
      expect(result).toBeNull();
    });

    it('calls onProgress callback with 1 on success', async () => {
      const onProgress = jest.fn();
      await uploadMedia('file://test.jpg', 'chats/abc/msg123.jpg', onProgress);
      expect(onProgress).toHaveBeenCalledWith(1);
    });

    it('determines content type from file extension', async () => {
      await uploadMedia('file://test.png', 'chats/abc/img.png');
      const supabase = getSupabase();
      const uploadCall = supabase.storage.from().upload.mock.calls[0];
      expect(uploadCall[2].contentType).toBe('image/png');
    });
  });

  describe('uploadEncryptedMedia', () => {
    it('returns mediaUrl, mediaKey, mediaIv on success', async () => {
      const result = await uploadEncryptedMedia('file://test.jpg', 'chats/abc/msg123.jpg');
      expect(result).toMatchObject({
        mediaUrl: expect.stringContaining('supabase.co'),
        mediaKey: expect.any(String),
        mediaIv: expect.any(String),
      });
    });

    it('returns null on upload error', async () => {
      const supabase = getSupabase();
      supabase.storage.from().upload.mockImplementationOnce(async () => ({ error: new Error('Upload failed') }));
      const result = await uploadEncryptedMedia('file://test.jpg', 'chats/abc/msg123.jpg');
      expect(result).toBeNull();
    });
  });

  describe('uploadChatMedia', () => {
    it('constructs correct path and delegates to uploadMedia', async () => {
      const url = await uploadChatMedia('chat123', 'msg456', 'file://test.jpg');
      expect(url).toContain('chats/chat123/msg456.jpg');
    });
  });

  describe('uploadPostMedia', () => {
    it('constructs correct path for image', async () => {
      const url = await uploadPostMedia('post123', 'file://test.jpg');
      expect(url).toContain('posts/post123/media.jpg');
    });

    it('constructs correct path for video', async () => {
      const url = await uploadPostMedia('post123', 'file://test.mp4', 'video');
      expect(url).toContain('posts/post123/media.mp4');
    });

    it('detects video from uri extension', async () => {
      const url = await uploadPostMedia('post123', 'file://test.mov');
      expect(url).toContain('media.mp4');
    });
  });

  describe('uploadStoryMedia', () => {
    it('constructs correct path', async () => {
      const url = await uploadStoryMedia('user123', 'story456', 'file://test.jpg');
      expect(url).toContain('stories/user123/story456.jpg');
    });
  });

  describe('uploadAvatar', () => {
    it('constructs correct path', async () => {
      const url = await uploadAvatar('user123', 'file://avatar.jpg');
      expect(url).toContain('avatars/user123.jpg');
    });
  });

  describe('deleteMedia', () => {
    it('calls supabase remove with path', async () => {
      const result = await deleteMedia('chats/abc/msg.jpg');
      expect(result).toBe(true);
    });

    it('returns false on error', async () => {
      const supabase = getSupabase();
      supabase.storage.from().remove.mockImplementationOnce(async () => ({ error: new Error('Delete failed') }));
      const result = await deleteMedia('chats/abc/msg.jpg');
      expect(result).toBe(false);
    });
  });
});
