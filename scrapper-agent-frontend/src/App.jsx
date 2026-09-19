import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import CityDiscovery from './views/CityDiscovery';
import AgentRegistry from './views/AgentRegistry';
import GenericView from './views/GenericView';
import {
  Sliders,
  Calendar,
  PlayCircle,
  RefreshCw,
  BarChart3,
  Zap,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('city-discovery');
  const [runners, setRunners] = useState([]);
  const [sessionUser, setSessionUser] = useState('MyBlocks Client (919)');

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/runners');
      if (res.ok) {
        const data = await res.json();
        if (data && data.runners) {
          setRunners(data.runners);
        }
      }
    } catch (e) {
      console.warn('[ORCHESTRATOR STATUS FETCH WARN]', e.message);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  const renderActiveTabContent = () => {
    switch (activeTab) {
      case 'city-discovery':
        return <CityDiscovery runners={runners} onRefreshStatus={fetchStatus} />;
      case 'agent-registry':
        return <AgentRegistry runners={runners} onRefreshStatus={fetchStatus} />;
      case 'agent-allocation':
        return <GenericView title="Agent Allocation" description="Automated runner network load balancer and batch distributor." icon={Sliders} />;
      case 'batch-scheduler':
        return <GenericView title="Batch Scheduler" description="Dynamic workflow batch partitioner and queue scheduler." icon={Calendar} />;
      case 'execution-pipeline':
        return <GenericView title="Execution Pipeline" description="Distributed runner execution monitor and active batch stage progress." icon={PlayCircle} />;
      case 'auto-reallocation':
        return <GenericView title="Auto Reallocation" description="Self-healing crash recovery and live runner reallocation stream." icon={RefreshCw} />;
      case 'performance-matrix':
        return <GenericView title="Performance Matrix" description="Real-time scraping analytics, company counts, and velocity metrics." icon={BarChart3} />;
      case 'performance-improvements':
        return <GenericView title="Performance Improvements" description="Algorithmic optimizations, rate limit tuners, and proxy health." icon={Zap} />;
      case 'error-recovery':
        return <GenericView title="Error Recovery" description="Common scraper error logs, failed request retries, and exceptions." icon={AlertTriangle} />;
      case 'quality-check':
        return <GenericView title="Quality Check" description="Scraped vendor data validator and database record verification." icon={CheckCircle2} />;
      default:
        return <CityDiscovery runners={runners} onRefreshStatus={fetchStatus} />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="main-content">
        <Header activeTabLabel={activeTab} runnersCount={runners.length} sessionUser={sessionUser} />
        <div className="app-container">
          {renderActiveTabContent()}
        </div>
        <footer className="app-footer">
          <p>Scraper Agent Orchestrator &copy; {new Date().getFullYear()} MyBlocks Enterprise AI Platform. Built with React.js & Node.js Express.</p>
        </footer>
      </main>
    </div>
  );
}
