import { cancelGeneration } from '../api';
import type { QueueStatus, QueueItem } from '../types';

interface Props {
  queueStatus: QueueStatus | null;
  onRefresh: () => void;
}

export default function QueueList({ queueStatus, onRefresh }: Props) {
  const handleCancel = async (id: string) => {
    try {
      await cancelGeneration(id);
      onRefresh();
    } catch (e) {
      console.error('Failed to cancel:', e);
    }
  };

  if (!queueStatus || queueStatus.items.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <h3 className="text-xl font-medium text-gray-400 mb-2">Queue is empty</h3>
        <p className="text-gray-500">Generate some music to see it here</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Generation Queue</h2>
        <button
          onClick={onRefresh}
          className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="space-y-3">
        {queueStatus.items.map((item, index) => (
          <QueueItemCard
            key={item.id}
            item={item}
            position={index + 1}
            isActive={item.id === queueStatus.active_id}
            onCancel={() => handleCancel(item.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface QueueItemCardProps {
  item: QueueItem;
  position: number;
  isActive: boolean;
  onCancel: () => void;
}

function QueueItemCard({ item, position, isActive, onCancel }: QueueItemCardProps) {
  const progressPercent = item.total_frames > 0
    ? Math.round((item.progress / item.total_frames) * 100)
    : 0;

  return (
    <div className={`bg-gray-800 rounded-lg p-4 border ${isActive ? 'border-blue-500' : 'border-gray-700'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            isActive ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'
          }`}>
            {position}
          </span>
          <div>
            <h4 className="text-white font-medium">
              {item.title || `Generation ${item.id.slice(0, 8)}`}
            </h4>
            <p className="text-sm text-gray-400">
              {item.status === 'processing'
                ? `Processing: ${item.progress}/${item.total_frames} frames (${progressPercent}%)`
                : item.status === 'pending'
                ? 'Waiting in queue...'
                : item.status}
            </p>
          </div>
        </div>

        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-red-400 transition-colors p-1"
          title="Cancel"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {isActive && item.status === 'processing' && (
        <div className="relative h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-blue-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Tags:</span>
          <p className="text-gray-300 truncate">{item.tags}</p>
        </div>
        <div>
          <span className="text-gray-500">Lyrics preview:</span>
          <p className="text-gray-300 truncate">{item.lyrics.slice(0, 100)}...</p>
        </div>
      </div>
    </div>
  );
}
