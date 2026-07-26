import firebase from 'firebase/compat/app';

export interface LinkPreviewData {
  url: string;
  title: string;
  description: string;
  image: string;
  siteName: string;
}

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

export function extractUrl(text: string): string | null {
  const match = text.match(URL_REGEX);
  return match ? match[0] : null;
}

export async function fetchLinkPreview(url: string): Promise<LinkPreviewData | null> {
  try {
    const fetchLinkPreviewFn = firebase.functions().httpsCallable('fetchLinkPreview');
    const result = await fetchLinkPreviewFn({ url });
    const data = result.data as LinkPreviewData;
    if (data.title || data.description || data.image) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}
