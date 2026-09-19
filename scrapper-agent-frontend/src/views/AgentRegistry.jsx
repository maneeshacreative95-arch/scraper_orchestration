import React, { useState } from 'react';
import AddRunnerForm from './agent-registry/AddRunnerForm';
import RunnerTable from './agent-registry/RunnerTable';
import { Plus } from 'lucide-react';

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
          <AddRunnerForm
            serverName={serverName}
            setServerName={setServerName}
            hostIp={hostIp}
            setHostIp={setHostIp}
            agentName={agentName}
            setAgentName={setAgentName}
            isSubmitting={isSubmitting}
            handleAddRunner={handleAddRunner}
          />
        )}

        <RunnerTable
          runners={runners}
          handleStartRunner={handleStartRunner}
          handleStopRunner={handleStopRunner}
          handleDeleteRunner={handleDeleteRunner}
        />
      </div>
    </div>
  );
}
