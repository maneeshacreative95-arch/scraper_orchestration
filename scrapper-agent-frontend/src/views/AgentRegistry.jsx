import React, { useState } from 'react';
import { apiFetch } from '../api/config';
import { getAuthContext } from '../utils/auth';
import AddRunnerForm from './agent-registry/AddRunnerForm';
import RunnerTable from './agent-registry/RunnerTable';
import PasswordModal from '../components/PasswordModal';
import { Plus } from 'lucide-react';

export default function AgentRegistry({ runners = [], onRefreshStatus }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [serverName, setServerName] = useState('');
  const [hostIp, setHostIp] = useState('');
  const [agentName, setAgentName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State for superadmin password modal prompt
  const [pendingAction, setPendingAction] = useState(null); // { actionType, runnerId, runnerName }

  const isOtherPersonRunner = (runner) => {
    if (!runner) return false;
    const { userId } = getAuthContext();
    const currentUserId = String(userId || '919').trim();

    let runnerClientId = runner.client_id !== undefined && runner.client_id !== null ? String(runner.client_id).trim() : null;
    if (!runnerClientId) {
      const match = (runner.agent_name || runner.runner_id || runner.server_name || '').match(/(\d+)/);
      if (match && match[1]) runnerClientId = match[1];
    }

    return Boolean(runnerClientId && runnerClientId !== currentUserId);
  };

  const handleAddRunner = async (e) => {
    e.preventDefault();
    if (!serverName || !agentName) {
      alert('Server Name and Agent Name are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/runners/add', {
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

  const executeRunnerAction = async (actionType, runnerId, superadminPassword = null) => {
    let endpoint = `/api/runners/${actionType}`;
    let method = 'POST';
    let bodyData = { runner_id: runnerId };

    if (superadminPassword) {
      bodyData.superadmin_password = superadminPassword;
    }

    if (actionType === 'delete') {
      endpoint = '/api/runners/delete';
    }

    const res = await apiFetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(superadminPassword ? { 'x-superadmin-password': superadminPassword } : {})
      },
      body: JSON.stringify(bodyData)
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || `Failed to ${actionType} runner`);
    }

    if (onRefreshStatus) onRefreshStatus();
    return data;
  };

  const handleStartRunner = async (runnerId) => {
    const runner = runners.find(r => r.runner_id === runnerId);
    if (runner && isOtherPersonRunner(runner)) {
      setPendingAction({
        actionType: 'start',
        runnerId,
        runnerName: runner.server_name || runner.agent_name || runnerId
      });
      return;
    }

    try {
      await executeRunnerAction('start', runnerId);
    } catch (e) {
      alert('Error starting runner: ' + e.message);
    }
  };

  const handleStopRunner = async (runnerId) => {
    const runner = runners.find(r => r.runner_id === runnerId);
    if (runner && isOtherPersonRunner(runner)) {
      setPendingAction({
        actionType: 'stop',
        runnerId,
        runnerName: runner.server_name || runner.agent_name || runnerId
      });
      return;
    }

    try {
      await executeRunnerAction('stop', runnerId);
    } catch (e) {
      alert('Error stopping runner: ' + e.message);
    }
  };

  const handleDeleteRunner = async (runnerId) => {
    const runner = runners.find(r => r.runner_id === runnerId);
    if (runner && isOtherPersonRunner(runner)) {
      setPendingAction({
        actionType: 'delete',
        runnerId,
        runnerName: runner.server_name || runner.agent_name || runnerId
      });
      return;
    }

    if (!confirm(`Delete runner ${runnerId}?`)) return;
    try {
      await executeRunnerAction('delete', runnerId);
    } catch (e) {
      alert('Error deleting runner: ' + e.message);
    }
  };

  const handleModalConfirm = async (password) => {
    if (!pendingAction) return;
    await executeRunnerAction(pendingAction.actionType, pendingAction.runnerId, password);
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

      <PasswordModal
        isOpen={Boolean(pendingAction)}
        onClose={() => setPendingAction(null)}
        onConfirm={handleModalConfirm}
        actionType={pendingAction?.actionType}
        runnerName={pendingAction?.runnerName}
      />
    </div>
  );
}
