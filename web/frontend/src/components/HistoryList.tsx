import { useState } from 'react';
import { deleteHistoryItem, getThumbnailUrl } from '../api';
import type { HistoryResponse, HistoryItem } from '../types';

interface Props {
  history: HistoryResponse | null;
  onRefresh: (page?: number, search?: string) => void;
  onPlay: (item: HistoryItem) => void;
  onDelete: () => void;
}

export default function HistoryList({ history, onRefresh, onPlay, onDelete }: Props) {
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onRefresh(1, search || undefined);
  };

  const handleDelete = async (item: HistoryItem) => {
    if (!confirm(`Delete "${item.title || item.id.slice(0, 8)}"?`)) return;

    setDeleting(item.id);
    try {
      await deleteHistoryItem(item.id);
      onDelete();
    } catch (e) {
      console.error('Failed to delete:', e);
    } finally {
      setDeleting(null);
    }
  };

  const handlePageChange = (page: number) => {
    onRefresh(page, search || undefined);
  };

  if (!history) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto" />
        <p className="text-gray-400 mt-4">Loading history...</p>
      </div>
    );
  }

  const totalPages = Math.ceil(history.total / history.page_size);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-white">Generation History</h2>

        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
          >
            Search
          </button>
        </form>
      </div>

      {history.items.length === 0 ? (
        <div className="text-center py-12">
          <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
          <h3 className="text-xl font-medium text-gray-400 mb-2">No generations yet</h3>
          <p className="text-gray-500">Your generated music will appear here</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {history.items.map((item) => (
              <HistoryItemCard
                key={item.id}
                item={item}
                onPlay={() => onPlay(item)}
                onDelete={() => handleDelete(item)}
                deleting={deleting === item.id}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => handlePageChange(history.page - 1)}
                disabled={history.page <= 1}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 disabled:text-gray-600 text-white rounded-lg text-sm transition-colors"
              >
                Previous
              </button>
              <span className="text-gray-400 text-sm px-4">
                Page {history.page} of {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(history.page + 1)}
                disabled={history.page >= totalPages}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 disabled:text-gray-600 text-white rounded-lg text-sm transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface HistoryItemCardProps {
  item: HistoryItem;
  onPlay: () => void;
  onDelete: () => void;
  deleting: boolean;
}

function HistoryItemCard({ item, onPlay, onDelete, deleting }: HistoryItemCardProps) {
  const [imageError, setImageError] = useState(false);

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  };

  const hasThumbnail = item.thumbnail_path && !imageError;

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-gray-600 transition-colors group">
      {/* Thumbnail / Play Area */}
      <button
        onClick={onPlay}
        className="relative w-full aspect-square bg-gray-900 overflow-hidden"
      >
        {hasThumbnail ? (
          <img
            src={getThumbnailUrl(item.id)}
            alt={item.title || 'Song thumbnail'}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
            <svg className="w-16 h-16 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
        )}
        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-900 ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
        {/* Duration badge */}
        <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 rounded text-xs text-white">
          {formatDuration(item.duration_ms)}
        </div>
      </button>

      {/* Info */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="text-white font-medium truncate">
              {item.title || `Generation ${item.id.slice(0, 8)}`}
            </h4>
            <p className="text-xs text-gray-400 truncate mt-0.5">
              {item.tags}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {formatDate(item.created_at)}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            disabled={deleting}
            className="text-gray-400 hover:text-red-400 disabled:text-gray-600 transition-colors p-1 flex-shrink-0"
            title="Delete"
          >
            {deleting ? (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
