export interface VideoMetadata {
  title: string;
  plot: string;
  tags: string[];
  duration?: number;
  width?: number;
  height?: number;
}

export interface SubtitleTrack {
  label: string;
  language: string;
  fileHandle: File;
}

export interface VideoAsset {
  id: string; // UUID
  collectionId: string; // Renamed from containerId
  fileName: string; // Original filename e.g. "movie.mp4"
  relativePath: string; // "folder/movie.mp4" - crucial for relinking
  fileHandle: File | null; // The actual file object (not serializable)
  thumbnailUrl: string | null; // Blob URL
  metadata: VideoMetadata;
  size: number;
  subtitles: SubtitleTrack[];
}

export interface Collection { // Renamed from Container
  id: string;
  name: string;
  thumbnailUrl: string | null; // Derived from one of its videos
}

export interface AppState {
  collections: Collection[];
  videos: VideoAsset[];
}

export interface PlaybackState {
  isPlaying: boolean;
  currentVideoId: string | null;
  queue: string[]; // List of Video IDs in current shuffle scope
  isShuffling: boolean;
  volume: number;
}

export const SUPPORTED_EXTENSIONS = ['.mp4', '.mkv', '.ts', '.rmvb', '.avi', '.flv', '.webm'];
export const SUBTITLE_EXTENSIONS = ['.srt', '.vtt', '.ass', '.ssa'];