import { useState } from 'react';
import { deleteHistoryItem } from '../api';
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
          <div className="grid gap-3">
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
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors">
      <div className="flex items-start gap-4">
        <button
          onClick={onPlay}
          className="w-12 h-12 flex items-center justify-center bg-blue-600 hover:bg-blue-700 rounded-full text-white transition-colors flex-shrink-0"
        >
          <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-white font-medium truncate">
                {item.title || `Generation ${item.id.slice(0, 8)}`}
              </h4>
              <p className="text-sm text-gray-400">
                {formatDuration(item.duration_ms)} &bull; {formatDate(item.created_at)}
              </p>
            </div>
            <button
              onClick={onDelete}
              disabled={deleting}
              className="text-gray-400 hover:text-red-400 disabled:text-gray-600 transition-colors p-1 flex-shrink-0"
              title="Delete"
            >
              {deleting ? (
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
            </button>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Tags:</span>
              <p className="text-gray-300 truncate">{item.tags}</p>
            </div>
            <div>
              <span className="text-gray-500">Settings:</span>
              <p className="text-gray-300">
                T:{item.temperature.toFixed(1)} K:{item.topk} CFG:{item.cfg_scale.toFixed(1)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
