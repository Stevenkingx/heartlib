export type GenerationStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface GenerationRequest {
  lyrics: string;
  tags: string;
  title?: string;
  max_audio_length_ms: number;
  temperature: number;
  topk: number;
  cfg_scale: number;
}

export interface GenerationResponse {
  id: string;
  status: GenerationStatus;
  message: string;
}

export interface QueueItem {
  id: string;
  title: string | null;
  status: GenerationStatus;
  progress: number;
  total_frames: number;
  created_at: string;
  lyrics: string;
  tags: string;
}

export interface QueueStatus {
  items: QueueItem[];
  active_id: string | null;
}

export interface HistoryItem {
  id: string;
  title: string | null;
  lyrics: string;
  tags: string;
  audio_path: string;
  created_at: string;
  duration_ms: number;
  temperature: number;
  topk: number;
  cfg_scale: number;
}

export interface HistoryResponse {
  items: HistoryItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface ProgressUpdate {
  id: string;
  status: GenerationStatus;
  progress: number;
  total_frames: number;
  message: string;
}

export interface SystemStatus {
  gpu_available: boolean;
  gpu_name: string | null;
  model_loaded: boolean;
  queue_length: number;
}
