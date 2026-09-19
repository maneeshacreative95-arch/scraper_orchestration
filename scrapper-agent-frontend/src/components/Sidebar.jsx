import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Compass,
  Bot,
  Sliders,
  Calendar,
  PlayCircle,
  RefreshCw,
  BarChart3,
  Zap,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'city-discovery', path: '/city-discovery', label: 'City Discovery', icon: Compass },
  { id: 'agent-registry', path: '/agent-registry', label: 'Agent Registry', icon: Bot },
  { id: 'agent-allocation', path: '/agent-allocation', label: 'Agent Allocation', icon: Sliders },
  { id: 'batch-scheduler', path: '/batch-scheduler', label: 'Batch Scheduler', icon: Calendar },
  { id: 'execution-pipeline', path: '/execution-pipeline', label: 'Execution Pipeline', icon: PlayCircle },
  { id: 'auto-reallocation', path: '/auto-reallocation', label: 'Auto Reallocation', icon: RefreshCw },
  { id: 'performance-matrix', path: '/performance-matrix', label: 'Performance Matrix', icon: BarChart3 },
  { id: 'performance-improvements', path: '/performance-improvements', label: 'Performance Improvements', icon: Zap },
  { id: 'error-recovery', path: '/error-recovery', label: 'Error Recovery', icon: AlertTriangle },
  { id: 'quality-check', path: '/quality-check', label: 'Quality Check', icon: CheckCircle2 }
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <aside className="app-sidebar">
      <div>
        <div className="logo-area">
          <div className="pulse-ring"></div>
          <div className="logo-title">
            <h1>SCRAPER AGENT</h1>
            <span className="sub-badge">ORCHESTRATOR</span>
          </div>
        </div>

        <nav className="workflow-nav">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path) || (location.pathname === '/' && item.id === 'city-discovery');
            return (
              <button
                key={item.id}
                className={`nav-btn ${isActive ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
              >
                <Icon size={18} style={{ color: isActive ? '#3b82f6' : 'var(--color-text-muted)' }} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="sidebar-footer">
        <h3>Orchestrator Logs</h3>
        <p>Dynamic standalone controller active. Connected to scraper backend at port 7800.</p>
      </div>
    </aside>
  );
}
