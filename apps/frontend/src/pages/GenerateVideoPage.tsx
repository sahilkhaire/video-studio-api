import { useState } from 'react';
import { apiClient } from '../api/client';
import { GenerateVideoRequest, VideoJob } from '../types/api';
import '../styles/page.css';

export default function GenerateVideoPage() {
  const [topic, setTopic] = useState('');
  const [duration, setDuration] = useState(30);
  const [style, setStyle] = useState('cinematic');
  const [provider, setProvider] = useState('openai');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<VideoJob | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const request: GenerateVideoRequest = {
        topic,
        duration,
        style,
        provider,
      };
      const result = await apiClient.generateVideo(request);
      setJob(result);
      setTopic('');
      alert(`Video generation started! Job ID: ${result.jobId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate video');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <h2>Generate Video</h2>

      <form onSubmit={handleSubmit} className="form">
        <div className="form-group">
          <label>Topic/Prompt</label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Describe the video you want to generate..."
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Duration (seconds)</label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              min={10}
              max={300}
            />
          </div>

          <div className="form-group">
            <label>Style</label>
            <select value={style} onChange={(e) => setStyle(e.target.value)}>
              <option value="cinematic">Cinematic</option>
              <option value="documentary">Documentary</option>
              <option value="comedy">Comedy</option>
              <option value="educational">Educational</option>
            </select>
          </div>

          <div className="form-group">
            <label>Provider</label>
            <select value={provider} onChange={(e) => setProvider(e.target.value)}>
              <option value="openai">OpenAI</option>
              <option value="claude">Claude</option>
              <option value="together">Together</option>
            </select>
          </div>
        </div>

        <button type="submit" disabled={loading || !topic}>
          {loading ? 'Generating...' : 'Generate Video'}
        </button>
      </form>

      {error && <div className="error">{error}</div>}
      {job && (
        <div className="success">
          <h3>Video Generation Started</h3>
          <p>Job ID: <code>{job.jobId}</code></p>
          <p>Status: {job.status}</p>
        </div>
      )}
    </div>
  );
}
