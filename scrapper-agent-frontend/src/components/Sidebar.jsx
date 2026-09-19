import React from 'react';
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
  { id: 'city-discovery', label: 'City Discovery', icon: Compass },
  { id: 'agent-registry', label: 'Agent Registry', icon: Bot },
  { id: 'agent-allocation', label: 'Agent Allocation', icon: Sliders },
  { id: 'batch-scheduler', label: 'Batch Scheduler', icon: Calendar },
  { id: 'execution-pipeline', label: 'Execution Pipeline', icon: PlayCircle },
  { id: 'auto-reallocation', label: 'Auto Reallocation', icon: RefreshCw },
  { id: 'performance-matrix', label: 'Performance Matrix', icon: BarChart3 },
  { id: 'performance-improvements', label: 'Performance Improvements', icon: Zap },
  { id: 'error-recovery', label: 'Error Recovery', icon: AlertTriangle },
  { id: 'quality-check', label: 'Quality Check', icon: CheckCircle2 }
];

export default function Sidebar({ activeTab, setActiveTab }) {
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
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                className={`nav-btn ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTab(item.id)}
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
