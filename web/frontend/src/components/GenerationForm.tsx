import { useState } from 'react';
import { generate, generateAILyrics } from '../api';
import type { GenerationRequest } from '../types';

interface Props {
  onGenerate: () => void;
  gpuAvailable: boolean;
  openaiConfigured: boolean;
}

type Mode = 'manual' | 'ai';

export default function GenerationForm({ onGenerate, gpuAvailable, openaiConfigured }: Props) {
  const [mode, setMode] = useState<Mode>('manual');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLanguage, setAiLanguage] = useState('english');
  const [aiLoading, setAiLoading] = useState(false);

  const [lyrics, setLyrics] = useState('');
  const [tags, setTags] = useState('');
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(120);
  const [temperature, setTemperature] = useState(1.0);
  const [topk, setTopk] = useState(50);
  const [cfgScale, setCfgScale] = useState(1.5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) {
      setError('Please describe the song you want to create');
      return;
    }

    setAiLoading(true);
    setError(null);

    try {
      const result = await generateAILyrics({
        prompt: aiPrompt.trim(),
        language: aiLanguage,
      });

      setTitle(result.title);
      setTags(result.tags);
      setLyrics(result.lyrics);
      setMode('manual'); // Switch to manual mode to show/edit the results
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate lyrics');
    } finally {
      setAiLoading(false);
    }
  };

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
    <div className="space-y-6">
      {/* Mode Toggle */}
      <div className="flex items-center gap-2 bg-gray-800 p-1 rounded-lg w-fit">
        <button
          type="button"
          onClick={() => setMode('manual')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === 'manual'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Write Lyrics
        </button>
        <button
          type="button"
          onClick={() => setMode('ai')}
          disabled={!openaiConfigured}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
            mode === 'ai'
              ? 'bg-purple-600 text-white'
              : openaiConfigured
              ? 'text-gray-400 hover:text-white'
              : 'text-gray-600 cursor-not-allowed'
          }`}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.896zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
          </svg>
          AI Assist
          {!openaiConfigured && (
            <span className="text-xs">(Not configured)</span>
          )}
        </button>
      </div>

      {/* AI Assist Mode */}
      {mode === 'ai' && openaiConfigured && (
        <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-700/50 rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2 text-purple-300">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.896zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
            </svg>
            <h3 className="font-medium">Describe your song</h3>
          </div>

          <p className="text-sm text-gray-400">
            Tell AI what kind of song you want. It will generate the title, tags, and complete lyrics for you.
          </p>

          <textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="Example: A melancholic ballad about lost love, with soft piano and emotional female vocals. The song should build up to a powerful chorus."
            rows={4}
            className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
          />

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-400">Language:</label>
              <select
                value={aiLanguage}
                onChange={(e) => setAiLanguage(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="english">English</option>
                <option value="spanish">Spanish</option>
                <option value="chinese">Chinese</option>
                <option value="japanese">Japanese</option>
                <option value="korean">Korean</option>
                <option value="french">French</option>
                <option value="german">German</option>
                <option value="portuguese">Portuguese</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleAIGenerate}
              disabled={aiLoading || !aiPrompt.trim()}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {aiLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Generate Lyrics
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Manual Form */}
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
    </div>
  );
}
