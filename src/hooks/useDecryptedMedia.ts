import { useEffect, useState, useRef } from 'react';
import { decryptAndCache } from '../services/crypto';

interface UseDecryptedMediaParams {
  mediaUrl?: string | null;
  mediaKey?: string | null;
  mediaIv?: string | null;
  mediaType?: string | null;
}

export function useDecryptedMedia({
  mediaUrl,
  mediaKey,
  mediaIv,
  mediaType,
}: UseDecryptedMediaParams): {
  uri: string | null;
  loading: boolean;
  error: Error | null;
} {
  const [uri, setUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const lastKey = useRef('');

  useEffect(() => {
    if (!mediaUrl) {
      setUri(null);
      setLoading(false);
      setError(null);
      return;
    }

    const key = `${mediaUrl}|${mediaKey || ''}`;
    if (key === lastKey.current && !loading) return;
    lastKey.current = key;

    let cancelled = false;
    setLoading(true);
    setError(null);

    decryptAndCache(
      mediaUrl,
      mediaKey || null,
      mediaIv || null,
      mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
    )
      .then((result) => {
        if (!cancelled) {
          setUri(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          setLoading(false);
          setUri(mediaUrl);
        }
      });

    return () => { cancelled = true; };
  }, [mediaUrl, mediaKey, mediaIv, mediaType]);

  return { uri, loading, error };
}