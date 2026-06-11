import { getSupabase } from './supabase';
import { File } from 'expo-file-system';

const BUCKET = 'rilaxy-media';

export const uploadMedia = async (
  uri: string,
  path: string
): Promise<string | null> => {
  try {
    const supabase = getSupabase();

    const file = new File(uri);
    const arrayBuffer = await file.arrayBuffer();

    const ext = path.split('.').pop() || 'jpg';
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    m4a: 'audio/mp4',
    wav: 'audio/wav',
    mp3: 'audio/mpeg',
    ogg: 'audio/ogg',
  };
    const contentType = mimeMap[ext] || 'image/jpeg';

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, arrayBuffer, {
        contentType,
      });

    if (error) throw error;

    const { data } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(path);

    return data.publicUrl;
  } catch (error: any) {
    console.error('Upload error:', error?.message || error);
    return null;
  }
};

export const uploadChatMedia = async (
  chatId: string,
  messageId: string,
  uri: string
): Promise<string | null> => {
  const ext = uri.split('.').pop() || 'jpg';
  const path = `chats/${chatId}/${messageId}.${ext}`;
  return uploadMedia(uri, path);
};

export const uploadPostMedia = async (
  postId: string,
  uri: string
): Promise<string | null> => {
  const ext = uri.split('.').pop() || 'jpg';
  const path = `posts/${postId}/image.${ext}`;
  return uploadMedia(uri, path);
};

export const uploadAvatar = async (
  userId: string,
  uri: string
): Promise<string | null> => {
  const ext = uri.split('.').pop() || 'jpg';
  const path = `avatars/${userId}.${ext}`;
  return uploadMedia(uri, path);
};

export const uploadStoryMedia = async (
  userId: string,
  storyId: string,
  uri: string
): Promise<string | null> => {
  const ext = uri.split('.').pop() || 'jpg';
  const path = `stories/${userId}/${storyId}.${ext}`;
  return uploadMedia(uri, path);
};

export const deleteMedia = async (path: string): Promise<boolean> => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.storage
      .from(BUCKET)
      .remove([path]);
    return !error;
  } catch {
    return false;
  }
};
