import React from 'react';
import { User, LogOut, Cpu, KeyRound } from 'lucide-react';

export default function Header({ activeTabLabel, runnersCount = 0, sessionUser = 'MyBlocks Client (919)' }) {
  return (
    <header className="app-header">
      <div className="header-left">
        <h2>Smart Scraper Dashboard</h2>
        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          <span className="badge badge-completed">ONLINE</span>
          <span className="badge badge-running">CONNECTED</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div className="sim-toggle-wrapper">
          <User size={14} style={{ color: '#60a5fa' }} />
          <span className="sim-label" style={{ color: '#e2e8f0', fontWeight: 600 }}>
            Session: <span style={{ color: '#60a5fa' }}>{sessionUser}</span>
          </span>
        </div>

        <div className="sim-toggle-wrapper">
          <Cpu size={14} style={{ color: runnersCount > 0 ? '#10b981' : '#ef4444' }} />
          <span className="sim-label">
            Runner Network: {' '}
            <span className={`badge ${runnersCount > 0 ? 'badge-completed' : 'badge-failed'}`}>
              {runnersCount > 0 ? `${runnersCount} RUNNERS CONNECTED` : 'NO RUNNERS CONNECTED'}
            </span>
          </span>
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => {
            if (confirm('Logout of session?')) {
              localStorage.clear();
              window.location.reload();
            }
          }}
          style={{ color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)' }}
        >
          <LogOut size={14} />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
}
