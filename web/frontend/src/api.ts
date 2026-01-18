import type {
  GenerationRequest,
  GenerationResponse,
  QueueStatus,
  HistoryResponse,
  HistoryItem,
  SystemStatus,
  AILyricsRequest,
  AILyricsResponse,
  AIThumbnailRequest,
  AIThumbnailResponse,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  User,
} from './types';

const API_BASE = '/api';

// Auth header getter - will be set by the AuthContext
let getAuthHeader: () => Record<string, string> = () => ({});

export function setAuthHeaderGetter(getter: () => Record<string, string>) {
  getAuthHeader = getter;
}

// Logout callback for 401 responses
let onUnauthorized: (() => void) | null = null;

export function setOnUnauthorized(callback: () => void) {
  onUnauthorized = callback;
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
      ...options?.headers,
    },
  });
  if (!response.ok) {
    if (response.status === 401 && onUnauthorized) {
      onUnauthorized();
    }
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || 'Request failed');
  }
  return response.json();
}

// Auth API
export async function login(request: LoginRequest): Promise<AuthResponse> {
  return fetchJson<AuthResponse>(`${API_BASE}/auth/login`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function register(request: RegisterRequest): Promise<AuthResponse> {
  return fetchJson<AuthResponse>(`${API_BASE}/auth/register`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function getCurrentUser(): Promise<User> {
  return fetchJson<User>(`${API_BASE}/auth/me`);
}

export async function getStatus(): Promise<SystemStatus> {
  return fetchJson<SystemStatus>(`${API_BASE}/status`);
}

export async function generate(request: GenerationRequest): Promise<GenerationResponse> {
  return fetchJson<GenerationResponse>(`${API_BASE}/generate`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function getQueueStatus(): Promise<QueueStatus> {
  return fetchJson<QueueStatus>(`${API_BASE}/queue`);
}

export async function cancelGeneration(id: string): Promise<void> {
  await fetchJson(`${API_BASE}/queue/${id}`, { method: 'DELETE' });
}

export async function getHistory(
  page: number = 1,
  pageSize: number = 20,
  search?: string
): Promise<HistoryResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    page_size: pageSize.toString(),
  });
  if (search) {
    params.set('search', search);
  }
  return fetchJson<HistoryResponse>(`${API_BASE}/history?${params}`);
}

export async function getHistoryItem(id: string): Promise<HistoryItem> {
  return fetchJson<HistoryItem>(`${API_BASE}/history/${id}`);
}

export async function deleteHistoryItem(id: string): Promise<void> {
  await fetchJson(`${API_BASE}/history/${id}`, { method: 'DELETE' });
}

export function getAudioUrl(id: string): string {
  return `${API_BASE}/audio/${id}`;
}

export function getThumbnailUrl(id: string): string {
  return `${API_BASE}/thumbnail/${id}`;
}

export function createWebSocket(
  onMessage: (data: unknown) => void,
  onClose?: () => void
): WebSocket {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${window.location.host}/ws/progress`);

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch {
      // Ignore non-JSON messages like pong
    }
  };

  ws.onclose = () => {
    onClose?.();
  };

  // Keep connection alive
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send('ping');
    }
  }, 30000);

  ws.addEventListener('close', () => clearInterval(pingInterval));

  return ws;
}

export async function generateAILyrics(request: AILyricsRequest): Promise<AILyricsResponse> {
  return fetchJson<AILyricsResponse>(`${API_BASE}/ai/lyrics`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function generateAIThumbnail(request: AIThumbnailRequest): Promise<AIThumbnailResponse> {
  return fetchJson<AIThumbnailResponse>(`${API_BASE}/ai/thumbnail`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}
