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
  return (
    <div className={`bg-gray-800/50 backdrop-blur rounded-2xl p-5 border ${isActive ? 'border-blue-500/50' : 'border-gray-700/50'}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-medium ${
            isActive ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'
          }`}>
            {position}
          </span>
          <div>
            <h4 className="text-white font-medium text-lg">
              {item.title || `Generation ${item.id.slice(0, 8)}`}
            </h4>
            <p className="text-sm text-gray-400 mt-0.5">
              {item.tags}
            </p>
          </div>
        </div>

        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-red-400 transition-colors p-2 hover:bg-gray-700/50 rounded-lg"
          title="Cancel"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Status Area */}
      {isActive && item.status === 'processing' ? (
        <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-xl p-4 border border-blue-700/30">
          <div className="flex items-center gap-4">
            {/* Animated Music Icon */}
            <div className="relative w-12 h-12 flex-shrink-0">
              <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping" />
              <div className="relative w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
            </div>

            <div className="flex-1">
              <h5 className="text-white font-medium mb-1">Creating your music...</h5>
              <p className="text-sm text-gray-400">
                This may take a few minutes. Feel free to come back later - your song will be saved automatically.
              </p>
            </div>
          </div>

          {/* Animated bars */}
          <div className="flex items-end justify-center gap-1 mt-4 h-8">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="w-2 bg-gradient-to-t from-blue-500 to-purple-500 rounded-full animate-pulse"
                style={{
                  height: `${Math.random() * 60 + 40}%`,
                  animationDelay: `${i * 0.1}s`,
                  animationDuration: `${0.5 + Math.random() * 0.5}s`,
                }}
              />
            ))}
          </div>
        </div>
      ) : item.status === 'pending' ? (
        <div className="bg-gray-700/30 rounded-xl p-4 border border-gray-600/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h5 className="text-gray-300 font-medium">Waiting in queue</h5>
              <p className="text-sm text-gray-500">Your song will start generating soon</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
