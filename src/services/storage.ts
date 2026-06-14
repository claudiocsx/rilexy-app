import { getSupabase } from './supabase';
import { File } from 'expo-file-system';
import { generateMediaKey, encryptMedia } from './crypto';

const BUCKET = 'rilaxy-media';

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

function extFromUri(uri: string, fallback = 'jpg'): string {
  return uri.split('.').pop()?.split('?')[0]?.toLowerCase() || fallback;
}

export const uploadMedia = async (
  uri: string,
  path: string
): Promise<string | null> => {
  try {
    const supabase = getSupabase();
    const file = new File(uri);
    const arrayBuffer = await file.arrayBuffer();

    const ext = extFromUri(path);
    const contentType = mimeMap[ext] || 'image/jpeg';

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, arrayBuffer, { contentType, upsert: true });

    if (error) throw error;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch (error: any) {
    console.error('Upload error:', error?.message || error);
    return null;
  }
};

export const uploadEncryptedMedia = async (
  uri: string,
  path: string,
): Promise<{ mediaUrl: string; mediaKey: string; mediaIv: string } | null> => {
  try {
    const supabase = getSupabase();
    const { key, iv } = await generateMediaKey();
    const encrypted = await encryptMedia(uri, key, iv);

    const ext = extFromUri(path);
    const contentType = mimeMap[ext] || 'image/jpeg';

    const encryptedBlob = new Blob([encrypted]);
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, encryptedBlob, { contentType, upsert: true });

    if (error) throw error;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return { mediaUrl: data.publicUrl, mediaKey: key, mediaIv: iv };
  } catch (error: any) {
    console.error('Encrypted upload error:', error?.message || error);
    return null;
  }
};

export const uploadChatMedia = async (
  chatId: string,
  messageId: string,
  uri: string
): Promise<string | null> => {
  const ext = extFromUri(uri);
  const path = `chats/${chatId}/${messageId}.${ext}`;
  return uploadMedia(uri, path);
};

export const uploadEncryptedChatMedia = async (
  chatId: string,
  messageId: string,
  uri: string,
): Promise<{ mediaUrl: string; mediaKey: string; mediaIv: string } | null> => {
  const ext = extFromUri(uri);
  const path = `chats/${chatId}/${messageId}.${ext}`;
  return uploadEncryptedMedia(uri, path);
};

export const uploadPostMedia = async (
  postId: string,
  uri: string,
  type?: 'image' | 'video'
): Promise<string | null> => {
  const isVideo = type === 'video' || /\.(mp4|mov|m4v|webm)$/i.test(uri);
  const ext = isVideo ? 'mp4' : 'jpg';
  const path = `posts/${postId}/media.${ext}`;
  return uploadMedia(uri, path);
};

export const uploadEncryptedPostMedia = async (
  postId: string,
  uri: string,
  type?: 'image' | 'video'
): Promise<{ mediaUrl: string; mediaKey: string; mediaIv: string } | null> => {
  const isVideo = type === 'video' || /\.(mp4|mov|m4v|webm)$/i.test(uri);
  const ext = isVideo ? 'mp4' : 'jpg';
  const path = `posts/${postId}/media.${ext}`;
  return uploadEncryptedMedia(uri, path);
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
