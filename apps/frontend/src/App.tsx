import { useState } from 'react';
import './App.css';
import GenerateVideoPage from './pages/GenerateVideoPage';
import JobStatusPage from './pages/JobStatusPage';
import ProvidersPage from './pages/ProvidersPage';
import CostSummaryPage from './pages/CostSummaryPage';
import HealthPage from './pages/HealthPage';

function App() {
  const [currentPage, setCurrentPage] = useState<'home' | 'generate' | 'jobs' | 'providers' | 'costs' | 'health'>('generate');

  return (
    <div className="app">
      <nav className="app-nav">
        <h1>Video Building Studio</h1>
        <ul>
          <li><button onClick={() => setCurrentPage('generate')} className={currentPage === 'generate' ? 'active' : ''}>Generate Video</button></li>
          <li><button onClick={() => setCurrentPage('jobs')} className={currentPage === 'jobs' ? 'active' : ''}>Job Status</button></li>
          <li><button onClick={() => setCurrentPage('providers')} className={currentPage === 'providers' ? 'active' : ''}>Providers</button></li>
          <li><button onClick={() => setCurrentPage('costs')} className={currentPage === 'costs' ? 'active' : ''}>Costs</button></li>
          <li><button onClick={() => setCurrentPage('health')} className={currentPage === 'health' ? 'active' : ''}>Health</button></li>
        </ul>
      </nav>

      <main className="app-main">
        {currentPage === 'generate' && <GenerateVideoPage />}
        {currentPage === 'jobs' && <JobStatusPage />}
        {currentPage === 'providers' && <ProvidersPage />}
        {currentPage === 'costs' && <CostSummaryPage />}
        {currentPage === 'health' && <HealthPage />}
      </main>
    </div>
  );
}

export default App;
