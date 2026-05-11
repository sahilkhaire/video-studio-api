import { useState } from 'react';
import { usePolling } from '../hooks/useAsync';
import { apiClient } from '../api/client';
import { VideoJob } from '../types/api';
import '../styles/page.css';

export default function JobStatusPage() {
  const [jobId, setJobId] = useState('');
  const [isPolling, setIsPolling] = useState(false);
  const [currentJob, setCurrentJob] = useState<VideoJob | null>(null);

  const { data, error, startPolling, stopPolling } = usePolling(
    () => apiClient.getJobStatus(jobId),
    3000,
    false
  );

  const handleStartPolling = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobId) return;

    try {
      setIsPolling(true);
      startPolling();
    } catch (err) {
      console.error(err);
    }
  };

  const handleStop = () => {
    stopPolling();
    setIsPolling(false);
  };

  if (data) {
    setCurrentJob(data);
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#4caf50';
      case 'failed':
        return '#f44336';
      case 'processing':
        return '#2196f3';
      default:
        return '#ff9800';
    }
  };

  return (
    <div className="page">
      <h2>Job Status Tracking</h2>

      <form onSubmit={handleStartPolling} className="form">
        <div className="form-group">
          <label>Job ID</label>
          <input
            type="text"
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            placeholder="Enter job ID to track..."
            required
          />
        </div>

        <div className="form-actions">
          <button type="submit" disabled={!jobId || isPolling}>
            Track Job
          </button>
          {isPolling && (
            <button type="button" onClick={handleStop} className="secondary">
              Stop Polling
            </button>
          )}
        </div>
      </form>

      {isPolling && (
        <div className="polling-status">
          <p>Polling every 3 seconds...</p>
        </div>
      )}

      {error && <div className="error">{error.message}</div>}

      {currentJob && (
        <div className="job-status-card">
          <h3>Job Details</h3>
          <div className="status-details">
            <div className="detail-row">
              <span className="label">Job ID:</span>
              <code>{currentJob.jobId}</code>
            </div>
            <div className="detail-row">
              <span className="label">Status:</span>
              <span style={{ color: getStatusColor(currentJob.status) }}>
                {currentJob.status.toUpperCase()}
              </span>
            </div>
            {currentJob.progress !== undefined && (
              <div className="detail-row">
                <span className="label">Progress:</span>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${currentJob.progress}%` }}
                  />
                </div>
                <span>{currentJob.progress}%</span>
              </div>
            )}
            <div className="detail-row">
              <span className="label">Created:</span>
              {new Date(currentJob.createdAt).toLocaleString()}
            </div>
            <div className="detail-row">
              <span className="label">Updated:</span>
              {new Date(currentJob.updatedAt).toLocaleString()}
            </div>
            {currentJob.error && (
              <div className="detail-row error-row">
                <span className="label">Error:</span>
                {currentJob.error}
              </div>
            )}
            {currentJob.result && (
              <div className="detail-row">
                <span className="label">Result:</span>
                <a href={currentJob.result.videoUrl} target="_blank" rel="noreferrer">
                  Download Video
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
