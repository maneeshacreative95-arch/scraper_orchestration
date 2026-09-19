import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { apiFetch } from './api/config';
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

function getCookie(name) {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[1]) : null;
}

export default function App() {
  const [runners, setRunners] = useState([]);
  const [sessionUser, setSessionUser] = useState('MyBlocks Client (919)');
  const location = useLocation();

  const fetchStatus = async () => {
    try {
      const res = await apiFetch('/api/runners');
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
    const userId = getCookie('userid') || getCookie('user_id') || getCookie('empid');
    const firmId = getCookie('firmid') || getCookie('firm_id') || getCookie('FIRMID');

    const hostname = window.location.hostname;
    const isProd = hostname.includes('myblocks.in') || (!['localhost', '127.0.0.1'].includes(hostname));

    if (isProd && (!userId || !firmId)) {
      window.location.href = 'https://myblocks.in/login';
      return;
    }

    if (userId) {
      setSessionUser(`MyBlocks User (${userId})`);
    }

    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, []);


  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Header activeTabLabel={location.pathname} runnersCount={runners.length} sessionUser={sessionUser} />
        <div className="app-container">
          <Routes>
            <Route path="/" element={<Navigate to="/city-discovery" replace />} />
            <Route path="/city-discovery" element={<CityDiscovery runners={runners} onRefreshStatus={fetchStatus} />} />
            <Route path="/agent-registry" element={<AgentRegistry runners={runners} onRefreshStatus={fetchStatus} />} />
            <Route path="/agent-allocation" element={<GenericView title="Agent Allocation" description="Automated runner network load balancer and batch distributor." icon={Sliders} />} />
            <Route path="/batch-scheduler" element={<GenericView title="Batch Scheduler" description="Dynamic workflow batch partitioner and queue scheduler." icon={Calendar} />} />
            <Route path="/execution-pipeline" element={<GenericView title="Execution Pipeline" description="Distributed runner execution monitor and active batch stage progress." icon={PlayCircle} />} />
            <Route path="/auto-reallocation" element={<GenericView title="Auto Reallocation" description="Self-healing crash recovery and live runner reallocation stream." icon={RefreshCw} />} />
            <Route path="/performance-matrix" element={<GenericView title="Performance Matrix" description="Real-time scraping analytics, company counts, and velocity metrics." icon={BarChart3} />} />
            <Route path="/performance-improvements" element={<GenericView title="Performance Improvements" description="Algorithmic optimizations, rate limit tuners, and proxy health." icon={Zap} />} />
            <Route path="/error-recovery" element={<GenericView title="Error Recovery" description="Common scraper error logs, failed request retries, and exceptions." icon={AlertTriangle} />} />
            <Route path="/quality-check" element={<GenericView title="Quality Check" description="Scraped vendor data validator and database record verification." icon={CheckCircle2} />} />
            <Route path="*" element={<Navigate to="/city-discovery" replace />} />
          </Routes>
        </div>
        <footer className="app-footer">
          <p>Scraper Agent Orchestrator &copy; {new Date().getFullYear()} MyBlocks Enterprise AI Platform. Built with React.js & Node.js Express.</p>
        </footer>
      </main>
    </div>
  );
}
