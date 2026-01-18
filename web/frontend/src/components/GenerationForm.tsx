import { useState } from 'react';
import { generate } from '../api';
import type { GenerationRequest } from '../types';

interface Props {
  onGenerate: () => void;
  gpuAvailable: boolean;
}

export default function GenerationForm({ onGenerate, gpuAvailable }: Props) {
  const [lyrics, setLyrics] = useState('');
  const [tags, setTags] = useState('');
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(120);
  const [temperature, setTemperature] = useState(1.0);
  const [topk, setTopk] = useState(50);
  const [cfgScale, setCfgScale] = useState(1.5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lyrics.trim() || !tags.trim()) {
      setError('Please provide both lyrics and tags');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const request: GenerationRequest = {
        lyrics: lyrics.trim(),
        tags: tags.trim(),
        title: title.trim() || undefined,
        max_audio_length_ms: duration * 1000,
        temperature,
        topk,
        cfg_scale: cfgScale,
      };

      await generate(request);
      onGenerate();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start generation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Title (optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My Song"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Tags *
            </label>
            <textarea
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="pop, female vocal, upbeat, synth, 120bpm"
              rows={3}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              Genre, mood, instruments, tempo, vocal type, etc.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Lyrics *
            </label>
            <textarea
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder="[Verse 1]&#10;Write your lyrics here...&#10;&#10;[Chorus]&#10;The chorus goes here..."
              rows={10}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm"
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-gray-800 rounded-lg p-4 space-y-4">
            <h3 className="text-lg font-medium text-white">Generation Settings</h3>

            <div>
              <label className="flex justify-between text-sm text-gray-300 mb-2">
                <span>Duration</span>
                <span className="text-blue-400">{duration}s ({Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')})</span>
              </label>
              <input
                type="range"
                min={10}
                max={240}
                step={10}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>10s</span>
                <span>4min</span>
              </div>
            </div>

            <div>
              <label className="flex justify-between text-sm text-gray-300 mb-2">
                <span>Temperature</span>
                <span className="text-blue-400">{temperature.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min={0.1}
                max={2.0}
                step={0.05}
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Conservative</span>
                <span>Creative</span>
              </div>
            </div>

            <div>
              <label className="flex justify-between text-sm text-gray-300 mb-2">
                <span>Top-K</span>
                <span className="text-blue-400">{topk}</span>
              </label>
              <input
                type="range"
                min={1}
                max={500}
                step={1}
                value={topk}
                onChange={(e) => setTopk(Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Focused</span>
                <span>Diverse</span>
              </div>
            </div>

            <div>
              <label className="flex justify-between text-sm text-gray-300 mb-2">
                <span>CFG Scale</span>
                <span className="text-blue-400">{cfgScale.toFixed(1)}</span>
              </label>
              <input
                type="range"
                min={1.0}
                max={5.0}
                step={0.1}
                value={cfgScale}
                onChange={(e) => setCfgScale(Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Loose</span>
                <span>Strict</span>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !gpuAvailable}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Adding to queue...
              </>
            ) : !gpuAvailable ? (
              'No GPU Available'
            ) : (
              'Generate Music'
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
