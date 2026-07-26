import { createAudioPlayer } from 'expo-audio';
import { Paths, File, Directory } from 'expo-file-system';

let player: ReturnType<typeof createAudioPlayer> | null = null;

const SAMPLE_RATE = 8000;
const RING_DURATION = 0.5;
const SILENCE_DURATION = 3.0;

function generateRingWav(): Uint8Array {
  const bitsPerSample = 16;
  const numChannels = 1;
  const freq1 = 440;
  const freq2 = 480;

  const ringSamples = Math.floor(SAMPLE_RATE * RING_DURATION);
  const silenceSamples = Math.floor(SAMPLE_RATE * SILENCE_DURATION);
  const ringBuf = new Int16Array(ringSamples);

  for (let i = 0; i < ringSamples; i++) {
    const t = i / SAMPLE_RATE;
    const val = Math.sin(2 * Math.PI * freq1 * t) + Math.sin(2 * Math.PI * freq2 * t);
    ringBuf[i] = Math.round((val / 2) * 32767 * 0.15);
  }

  const totalSamples = ringSamples + silenceSamples;
  const dataSize = totalSamples * (bitsPerSample / 8);
  const buf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * numChannels * (bitsPerSample / 8), true);
  view.setUint16(32, numChannels * (bitsPerSample / 8), true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < ringSamples; i++) {
    view.setInt16(offset, ringBuf[i], true);
    offset += 2;
  }
  for (let i = 0; i < silenceSamples; i++) {
    view.setInt16(offset, 0, true);
    offset += 2;
  }

  return new Uint8Array(buf);
}

let ringtoneFile: File | null = null;

async function ensureRingtoneFile(): Promise<File> {
  if (ringtoneFile?.exists) return ringtoneFile;
  const dir = new Directory(Paths.cache);
  if (!dir.exists) dir.create({ intermediates: true });
  const file = new File(Paths.cache, 'ringtone.wav');
  const wavBytes = generateRingWav();
  file.write(wavBytes);
  ringtoneFile = file;
  return file;
}

export async function playRingtone() {
  if (player) return;
  try {
    const file = await ensureRingtoneFile();
    player = createAudioPlayer({ uri: file.uri });
    player.loop = true;
    player.volume = 1.0;
    player.play();
  } catch {}
}

export async function stopRingtone() {
  if (!player) return;
  try {
    player.pause();
    player.remove();
  } catch {}
  player = null;
}
