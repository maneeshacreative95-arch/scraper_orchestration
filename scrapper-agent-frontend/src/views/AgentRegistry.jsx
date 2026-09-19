import React, { useState } from 'react';
import { Play, Square, Activity, Trash2, Plus } from 'lucide-react';

export default function AgentRegistry({ runners = [], onRefreshStatus }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [serverName, setServerName] = useState('');
  const [hostIp, setHostIp] = useState('');
  const [agentName, setAgentName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddRunner = async (e) => {
    e.preventDefault();
    if (!serverName || !agentName) {
      alert('Server Name and Agent Name are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/runners/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server_name: serverName, host_ip: hostIp, agent_name: agentName })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setServerName('');
        setHostIp('');
        setAgentName('');
        setShowAddForm(false);
        if (onRefreshStatus) onRefreshStatus();
      } else {
        alert(data.error || 'Failed to add runner.');
      }
    } catch (err) {
      alert(`Server error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartRunner = async (runnerId) => {
    try {
      const res = await fetch('/api/runners/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runner_id: runnerId })
      });
      const data = await res.json();
      if (!res.ok || !data.success) alert(data.error || 'Failed to start runner');
      if (onRefreshStatus) onRefreshStatus();
    } catch (e) {
      alert('Error starting runner: ' + e.message);
    }
  };

  const handleStopRunner = async (runnerId) => {
    try {
      const res = await fetch('/api/runners/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runner_id: runnerId })
      });
      const data = await res.json();
      if (!res.ok || !data.success) alert(data.error || 'Failed to stop runner');
      if (onRefreshStatus) onRefreshStatus();
    } catch (e) {
      alert('Error stopping runner: ' + e.message);
    }
  };

  const handleDeleteRunner = async (runnerId) => {
    if (!confirm(`Delete runner ${runnerId}?`)) return;
    try {
      const res = await fetch(`/api/runners/${runnerId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) alert(data.error || 'Failed to delete runner');
      if (onRefreshStatus) onRefreshStatus();
    } catch (e) {
      alert('Error deleting runner: ' + e.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="panel-card">
        <div className="panel-header">
          <div>
            <h2>Distributed Runner Registry (Step 5)</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              Distributed runners installed across host servers, GPU servers, and cloud instances.
            </p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddForm(!showAddForm)}>
            <Plus size={16} />
            {showAddForm ? 'Close Form' : 'Add Runner'}
          </button>
        </div>

        {showAddForm && (
          <form onSubmit={handleAddRunner} style={{ background: 'rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-card)', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <input className="input-style" placeholder="Server Name (e.g. GPU-SERVER-01)" value={serverName} onChange={(e) => setServerName(e.target.value)} required style={{ flex: 1 }} />
            <input className="input-style" placeholder="Host IP (Optional)" value={hostIp} onChange={(e) => setHostIp(e.target.value)} style={{ flex: 1 }} />
            <input className="input-style" placeholder="Agent Name (e.g. Client 919)" value={agentName} onChange={(e) => setAgentName(e.target.value)} required style={{ flex: 1 }} />
            <button type="submit" className="btn btn-primary btn-sm" disabled={isSubmitting}>
              {isSubmitting ? 'Registering...' : 'Submit Runner'}
            </button>
          </form>
        )}

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>SERVER NAME</th>
                <th>RUNNER ID</th>
                <th>VERSION</th>
                <th>ASSIGNED AGENT</th>
                <th>STATUS</th>
                <th>LAST HEARTBEAT</th>
                <th>CURRENT WORKFLOW</th>
                <th>CURRENT BATCH</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {runners.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem' }}>
                    No runners registered.
                  </td>
                </tr>
              ) : (
                runners.map((r) => {
                  const isRunning = r.status === 'Running' || r.status === 'Busy';
                  let statusClass = 'badge-completed';
                  if (isRunning) statusClass = 'badge-running';
                  else if (r.status === 'Offline' || r.status === 'Crashed') statusClass = 'badge-failed';

                  return (
                    <tr key={r.runner_id}>
                      <td><strong>{r.server_name || r.runner_name || '-'}</strong></td>
                      <td><code>{r.runner_id}</code></td>
                      <td>
                        {r.version ? (
                          <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.3)', fontSize: '0.72rem' }}>
                            v{String(r.version).replace(/^v/i, '')}
                          </span>
                        ) : '-'}
                      </td>
                      <td>{r.agent_name || '-'}</td>
                      <td>
                        <span className={`badge ${statusClass}`}>{r.status || 'Idle'}</span>
                      </td>
                      <td style={{ fontSize: '0.75rem' }}>
                        {r.last_heartbeat ? new Date(r.last_heartbeat).toLocaleTimeString() : '-'}
                      </td>
                      <td style={{ color: 'var(--accent-color)', fontWeight: 500 }}>{r.current_workflow || '-'}</td>
                      <td>{r.current_batch || '-'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {isRunning ? (
                            <button className="btn btn-secondary btn-sm" style={{ color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.4)' }} onClick={() => handleStopRunner(r.runner_id)}>
                              <Square size={14} /> Stop
                            </button>
                          ) : (
                            <button className="btn btn-secondary btn-sm" style={{ color: '#4ade80', borderColor: 'rgba(74, 222, 128, 0.4)' }} onClick={() => handleStartRunner(r.runner_id)}>
                              <Play size={14} /> Start
                            </button>
                          )}
                          <button className="btn btn-secondary btn-sm" style={{ color: 'var(--color-error)' }} onClick={() => handleDeleteRunner(r.runner_id)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
