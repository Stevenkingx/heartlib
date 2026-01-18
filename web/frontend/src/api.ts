import type {
  GenerationRequest,
  GenerationResponse,
  QueueStatus,
  HistoryResponse,
  HistoryItem,
  SystemStatus,
} from './types';

const API_BASE = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || 'Request failed');
  }
  return response.json();
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
