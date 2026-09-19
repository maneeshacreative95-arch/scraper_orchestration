import React from 'react';
import { Layers, Activity, CheckCircle, AlertTriangle } from 'lucide-react';

export default function GenericView({ title, description, icon: Icon = Layers }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="panel-card">
        <div className="panel-header" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Icon size={24} style={{ color: '#3b82f6' }} />
            <div>
              <h2>{title}</h2>
              {description && <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>{description}</p>}
            </div>
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-card)', padding: '2.5rem', borderRadius: '12px', textAlign: 'center' }}>
          <Activity size={32} style={{ color: '#60a5fa', marginBottom: '12px', animation: 'spin 4s linear infinite' }} />
          <h3 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>Active Orchestration Module</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', maxWidth: '600px', margin: '0 auto' }}>
            This orchestrator pipeline module is active and communicating with the Node.js scraper backend.
          </p>
        </div>
      </div>
    </div>
  );
}
