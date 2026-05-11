import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { CostSummary } from '../types/api';
import '../styles/page.css';

export default function CostSummaryPage() {
  const [costs, setCosts] = useState<CostSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCosts = async () => {
      try {
        setLoading(true);
        const data = await apiClient.getCostSummary();
        setCosts(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load costs');
      } finally {
        setLoading(false);
      }
    };

    fetchCosts();
  }, []);

  if (loading) return <div className="page"><p>Loading costs...</p></div>;
  if (error) return <div className="page error">{error}</div>;
  if (!costs) return <div className="page"><p>No cost data available</p></div>;

  const totalCostFormatted = costs.totalCost.toFixed(2);
  const maxBreakdownCost = Math.max(...Object.values(costs.breakdown));

  return (
    <div className="page">
      <h2>Cost Summary</h2>

      <div className="cost-summary-card">
        <div className="cost-header">
          <h3>Total Cost</h3>
          <div className="total-amount">
            {costs.currency} {totalCostFormatted}
          </div>
        </div>

        <div className="cost-stats">
          <div className="stat">
            <span className="label">Total Jobs</span>
            <span className="value">{costs.jobCount}</span>
          </div>
          <div className="stat">
            <span className="label">Average Cost per Job</span>
            <span className="value">
              {costs.currency} {(costs.totalCost / costs.jobCount).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <section>
        <h3>Cost Breakdown by Provider</h3>
        <div className="breakdown-list">
          {Object.entries(costs.breakdown).map(([provider, cost]) => {
            const percentage = (cost / maxBreakdownCost) * 100;
            return (
              <div key={provider} className="breakdown-item">
                <div className="breakdown-header">
                  <span className="provider-name">{provider}</span>
                  <span className="cost-value">
                    {costs.currency} {cost.toFixed(2)}
                  </span>
                </div>
                <div className="breakdown-bar">
                  <div
                    className="breakdown-fill"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
