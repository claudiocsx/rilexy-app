declare module 'expo-audio' {
  import { PermissionResponse } from 'expo-modules-core';

  type AudioSource = string | { uri?: string; assetId?: number; headers?: Record<string, string> };

  interface AudioStatus {
    id: number;
    currentTime: number;
    playbackState: string;
    timeControlStatus: string;
    reasonForWaitingToPlay: string;
    mute: boolean;
    duration: number;
    playing: boolean;
    loop: boolean;
    didJustFinish: boolean;
    isBuffering: boolean;
    isLoaded: boolean;
    playbackRate: number;
    shouldCorrectPitch: boolean;
  }

  interface AudioPlayerOptions {
    updateInterval?: number;
    downloadFirst?: boolean;
    keepAudioSessionActive?: boolean;
  }

  class AudioPlayer {
    id: number;
    playing: boolean;
    muted: boolean;
    loop: boolean;
    paused: boolean;
    isLoaded: boolean;
    isBuffering: boolean;
    currentTime: number;
    duration: number;
    volume: number;
    playbackRate: number;
    shouldCorrectPitch: boolean;
    play(): void;
    pause(): void;
    replace(source: AudioSource): void;
    seekTo(seconds: number, toleranceMillisBefore?: number, toleranceMillisAfter?: number): Promise<void>;
    setPlaybackRate(rate: number): void;
    remove(): void;
    addListener(event: string, listener: (...args: any[]) => void): { remove: () => void };
  }

  interface RecorderState {
    canRecord: boolean;
    isRecording: boolean;
    durationMillis: number;
    mediaServicesDidReset: boolean;
    metering?: number;
    url: string | null;
  }

  interface RecordingStatus {
    id: number;
    isFinished: boolean;
    hasError: boolean;
    error: string | null;
    url: string | null;
  }

  interface AudioMode {
    playsInSilentMode: boolean;
    interruptionMode: 'mixWithOthers' | 'doNotMix' | 'duckOthers';
    allowsRecording: boolean;
    shouldPlayInBackground: boolean;
    shouldRouteThroughEarpiece: boolean;
    allowsBackgroundRecording?: boolean;
  }

  type AndroidOutputFormat = 'default' | '3gp' | 'mpeg4' | 'amrnb' | 'amrwb' | 'aac_adts' | 'mpeg2ts' | 'webm';
  type AndroidAudioEncoder = 'default' | 'amr_nb' | 'amr_wb' | 'aac' | 'he_aac' | 'aac_eld';
  type AudioQuality = 'MIN' | 'LOW' | 'MEDIUM' | 'HIGH' | 'MAX';

  interface RecordingOptions {
    isMeteringEnabled?: boolean;
    extension: string;
    sampleRate: number;
    numberOfChannels: number;
    bitRate: number;
    android: {
      extension?: string;
      outputFormat: AndroidOutputFormat;
      audioEncoder: AndroidAudioEncoder;
      audioSource?: string;
    };
    ios: {
      extension?: string;
      sampleRate?: number;
      outputFormat?: string;
      audioQuality: AudioQuality | number;
      linearPCMBitDepth?: number;
      linearPCMIsBigEndian?: boolean;
      linearPCMIsFloat?: boolean;
    };
    web: {
      mimeType?: string;
      bitsPerSecond?: number;
    };
  }

  class AudioRecorder {
    id: number;
    currentTime: number;
    isRecording: boolean;
    uri: string | null;
    constructor(options: Partial<RecordingOptions>);
    record(): void;
    stop(): Promise<void>;
    pause(): void;
    prepareToRecordAsync(options?: Partial<RecordingOptions>): Promise<void>;
    getStatus(): RecorderState;
    addListener(event: string, listener: (...args: any[]) => void): { remove: () => void };
  }

  const RecordingPresets: {
    HIGH_QUALITY: RecordingOptions;
    LOW_QUALITY: RecordingOptions;
  };

  export function createAudioPlayer(source?: AudioSource, options?: AudioPlayerOptions): AudioPlayer;
  export function requestRecordingPermissionsAsync(): Promise<PermissionResponse>;
  export function getRecordingPermissionsAsync(): Promise<PermissionResponse>;
  export function setAudioModeAsync(mode: Partial<AudioMode>): Promise<void>;
  export function setIsAudioActiveAsync(active: boolean): Promise<void>;

  export { AudioPlayer, AudioRecorder, AudioStatus, AudioPlayerOptions, RecordingOptions, RecorderState, RecordingPresets, AudioMode };
}
