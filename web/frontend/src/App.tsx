import { useState, useEffect, useCallback } from 'react';
import GenerationForm from './components/GenerationForm';
import AudioPlayer from './components/AudioPlayer';
import QueueList from './components/QueueList';
import HistoryList from './components/HistoryList';
import {
  getStatus,
  getQueueStatus,
  getHistory,
  createWebSocket,
} from './api';
import type {
  SystemStatus,
  QueueStatus,
  HistoryResponse,
  ProgressUpdate,
  HistoryItem,
} from './types';

type Tab = 'generate' | 'queue' | 'history';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('generate');
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [selectedAudio, setSelectedAudio] = useState<HistoryItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const status = await getStatus();
      setSystemStatus(status);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch status');
    }
  }, []);

  const fetchQueue = useCallback(async () => {
    try {
      const queue = await getQueueStatus();
      setQueueStatus(queue);
    } catch (e) {
      console.error('Failed to fetch queue:', e);
    }
  }, []);

  const fetchHistory = useCallback(async (page = 1, search?: string) => {
    try {
      const hist = await getHistory(page, 20, search);
      setHistory(hist);
    } catch (e) {
      console.error('Failed to fetch history:', e);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchQueue();
    fetchHistory();

    const statusInterval = setInterval(fetchStatus, 10000);

    return () => {
      clearInterval(statusInterval);
    };
  }, [fetchStatus, fetchQueue, fetchHistory]);

  useEffect(() => {
    let ws: WebSocket | null = null;

    const connectWebSocket = () => {
      ws = createWebSocket(
        (data) => {
          const update = data as ProgressUpdate;
          setQueueStatus((prev) => {
            if (!prev) return prev;
            const items = prev.items.map((item) =>
              item.id === update.id
                ? { ...item, status: update.status, progress: update.progress }
                : item
            );
            if (update.status === 'completed' || update.status === 'failed' || update.status === 'cancelled') {
              fetchHistory();
              return { ...prev, items: items.filter((item) => item.id !== update.id) };
            }
            return { ...prev, items };
          });
        },
        () => {
          setTimeout(connectWebSocket, 3000);
        }
      );
    };

    connectWebSocket();

    return () => {
      ws?.close();
    };
  }, [fetchHistory]);

  const handleGenerate = useCallback(() => {
    fetchQueue();
    setActiveTab('queue');
  }, [fetchQueue]);

  const handlePlayAudio = useCallback((item: HistoryItem) => {
    setSelectedAudio(item);
  }, []);

  const handleDeleteItem = useCallback(() => {
    fetchHistory();
    if (selectedAudio) {
      setSelectedAudio(null);
    }
  }, [fetchHistory, selectedAudio]);

  return (
    <div className="min-h-screen bg-gray-900">
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white">HeartMuLa</h1>
            {systemStatus && (
              <div className="flex items-center gap-4 text-sm">
                <span className={`flex items-center gap-1 ${systemStatus.gpu_available ? 'text-green-400' : 'text-red-400'}`}>
                  <span className={`w-2 h-2 rounded-full ${systemStatus.gpu_available ? 'bg-green-400' : 'bg-red-400'}`} />
                  {systemStatus.gpu_available ? systemStatus.gpu_name : 'No GPU'}
                </span>
                {systemStatus.model_loaded && (
                  <span className="text-blue-400">Model loaded</span>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1">
            {(['generate', 'queue', 'history'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'text-white border-b-2 border-blue-500'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === 'queue' && queueStatus && queueStatus.items.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-blue-600 rounded-full">
                    {queueStatus.items.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {error && (
        <div className="max-w-6xl mx-auto px-4 mt-4">
          <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-4 text-red-400 hover:text-red-200"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 py-6">
        {activeTab === 'generate' && (
          <GenerationForm
            onGenerate={handleGenerate}
            gpuAvailable={systemStatus?.gpu_available ?? false}
          />
        )}

        {activeTab === 'queue' && (
          <QueueList
            queueStatus={queueStatus}
            onRefresh={fetchQueue}
          />
        )}

        {activeTab === 'history' && (
          <HistoryList
            history={history}
            onRefresh={fetchHistory}
            onPlay={handlePlayAudio}
            onDelete={handleDeleteItem}
          />
        )}
      </main>

      {selectedAudio && (
        <AudioPlayer
          item={selectedAudio}
          onClose={() => setSelectedAudio(null)}
        />
      )}
    </div>
  );
}

export default App;
