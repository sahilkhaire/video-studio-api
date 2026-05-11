import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { Provider, TTSVoice } from '../types/api';
import '../styles/page.css';

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [voices, setVoices] = useState<TTSVoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [providersData, voicesData] = await Promise.all([
          apiClient.getProviders(),
          apiClient.getTTSVoices(),
        ]);
        setProviders(providersData);
        setVoices(voicesData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load providers');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <div className="page"><p>Loading providers...</p></div>;
  if (error) return <div className="page error">{error}</div>;

  return (
    <div className="page">
      <h2>Providers & TTS Voices</h2>

      <div className="providers-grid">
        <section>
          <h3>AI Providers</h3>
          <div className="provider-list">
            {providers.map((provider) => (
              <div
                key={provider.id}
                className={`provider-card ${provider.active ? 'active' : 'inactive'}`}
              >
                <h4>{provider.name}</h4>
                <p className="type">{provider.type}</p>
                <div className="status">
                  {provider.active ? (
                    <span className="badge active">Active</span>
                  ) : (
                    <span className="badge inactive">Inactive</span>
                  )}
                </div>
                {provider.models && (
                  <div className="models">
                    <p className="models-label">Models:</p>
                    <ul>
                      {provider.models.map((model) => (
                        <li key={model}>{model}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3>TTS Voices</h3>
          <div className="voices-list">
            {voices.map((voice) => (
              <div key={voice.id} className="voice-card">
                <h4>{voice.name}</h4>
                <div className="voice-info">
                  <span className="label">Language:</span>
                  <span>{voice.language}</span>
                </div>
                <div className="voice-info">
                  <span className="label">Gender:</span>
                  <span>{voice.gender}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
