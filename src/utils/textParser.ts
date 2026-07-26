export type TextSegment =
  | { type: 'text'; content: string }
  | { type: 'hashtag'; content: string; tag: string }
  | { type: 'mention'; content: string; displayName: string };

export function parsePostText(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const regex = /(#[\w\u00C0-\u024F]+)|(@[\w\u00C0-\u024F]+(?:\s[\w\u00C0-\u024F]+)?)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    if (match[1]) {
      segments.push({ type: 'hashtag', content: match[1], tag: match[1].slice(1) });
    } else if (match[2]) {
      segments.push({ type: 'mention', content: match[2], displayName: match[2].slice(1).trim() });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return segments;
}
