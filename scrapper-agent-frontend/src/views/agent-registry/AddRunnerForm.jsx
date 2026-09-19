import React from 'react';

export default function AddRunnerForm({
  serverName,
  setServerName,
  hostIp,
  setHostIp,
  agentName,
  setAgentName,
  isSubmitting,
  handleAddRunner
}) {
  return (
    <form
      onSubmit={handleAddRunner}
      style={{
        background: 'rgba(255,255,255,0.03)',
        padding: '1.25rem',
        borderRadius: '12px',
        border: '1px solid var(--border-card)',
        marginBottom: '1.5rem',
        display: 'flex',
        gap: '1rem',
        flexWrap: 'wrap'
      }}
    >
      <input
        className="input-style"
        placeholder="Server Name (e.g. GPU-SERVER-01)"
        value={serverName}
        onChange={(e) => setServerName(e.target.value)}
        required
        style={{ flex: 1 }}
      />
      <input
        className="input-style"
        placeholder="Host IP (Optional)"
        value={hostIp}
        onChange={(e) => setHostIp(e.target.value)}
        style={{ flex: 1 }}
      />
      <input
        className="input-style"
        placeholder="Agent Name (e.g. Client 919)"
        value={agentName}
        onChange={(e) => setAgentName(e.target.value)}
        required
        style={{ flex: 1 }}
      />
      <button type="submit" className="btn btn-primary btn-sm" disabled={isSubmitting}>
        {isSubmitting ? 'Registering...' : 'Submit Runner'}
      </button>
    </form>
  );
}
