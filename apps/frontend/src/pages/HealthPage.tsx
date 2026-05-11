import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { HealthStatus, MongoDetails } from '../types/api';
import '../styles/page.css';

export default function HealthPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [mongoDetails, setMongoDetails] = useState<MongoDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        setLoading(true);
        const [healthData, mongoData] = await Promise.all([
          apiClient.getHealth(),
          apiClient.getMongoDetails().catch(() => null),
        ]);
        setHealth(healthData);
        if (mongoData) setMongoDetails(mongoData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load health status');
      } finally {
        setLoading(false);
      }
    };

    fetchHealth();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ok':
      case 'up':
        return '#4caf50';
      case 'degraded':
        return '#ff9800';
      case 'down':
        return '#f44336';
      default:
        return '#999';
    }
  };

  if (loading) return <div className="page"><p>Loading health status...</p></div>;
  if (error) return <div className="page error">{error}</div>;

  return (
    <div className="page">
      <h2>Health & Diagnostics</h2>

      {health && (
        <div className="health-card">
          <div className="health-header">
            <h3>Service Status</h3>
            <div
              className="status-badge"
              style={{ backgroundColor: getStatusColor(health.status) }}
            >
              {health.status.toUpperCase()}
            </div>
          </div>

          <div className="health-details">
            <div className="detail">
              <span className="label">Uptime:</span>
              <span>{Math.floor(health.uptime / 1000)}s</span>
            </div>
            <div className="detail">
              <span className="label">Last Check:</span>
              <span>{new Date(health.timestamp).toLocaleString()}</span>
            </div>
          </div>

          {health.services && (
            <div className="services-status">
              <h4>Service Details</h4>
              <div className="services-grid">
                {Object.entries(health.services).map(([service, status]) => (
                  <div key={service} className="service-item">
                    <span className="service-name">{service}</span>
                    <span
                      className="service-status"
                      style={{ color: getStatusColor(status) }}
                    >
                      {status.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {mongoDetails && (
        <div className="mongo-details-card">
          <h3>Database Details</h3>
          <div className="collections">
            {Object.entries(mongoDetails.collections).map(
              ([collectionName, collection]) => (
                <div key={collectionName} className="collection-info">
                  <h4>{collectionName}</h4>
                  <p>Documents: {collection.count}</p>
                  {collection.sample && (
                    <div className="sample-data">
                      <p className="sample-label">Sample Document:</p>
                      <pre>
                        {JSON.stringify(collection.sample, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )
            )}
          </div>

          {mongoDetails.costRecords && mongoDetails.costRecords.length > 0 && (
            <div className="cost-records">
              <h4>Recent Cost Records</h4>
              <div className="records-table">
                <div className="table-header">
                  <div>Job ID</div>
                  <div>Provider</div>
                  <div>Cost</div>
                  <div>Date</div>
                </div>
                {mongoDetails.costRecords.slice(0, 10).map((record, idx) => (
                  <div key={idx} className="table-row">
                    <div>
                      <code>{record.jobId}</code>
                    </div>
                    <div>{record.provider}</div>
                    <div>${record.cost.toFixed(2)}</div>
                    <div>{new Date(record.date).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
