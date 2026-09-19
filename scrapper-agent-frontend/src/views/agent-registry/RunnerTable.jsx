import React from 'react';
import { Play, Square, Trash2 } from 'lucide-react';

export default function RunnerTable({
  runners,
  handleStartRunner,
  handleStopRunner,
  handleDeleteRunner
}) {
  return (
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
                      <span
                        className="badge"
                        style={{
                          background: 'rgba(99, 102, 241, 0.15)',
                          color: '#818cf8',
                          border: '1px solid rgba(99, 102, 241, 0.3)',
                          fontSize: '0.72rem'
                        }}
                      >
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
                  <td style={{ color: 'var(--accent-color)', fontWeight: 500 }}>
                    {r.current_workflow || '-'}
                  </td>
                  <td>{r.current_batch || '-'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {isRunning ? (
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                          onClick={() => handleStopRunner(r.runner_id)}
                        >
                          <Square size={14} /> Stop
                        </button>
                      ) : (
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ color: '#4ade80', borderColor: 'rgba(74, 222, 128, 0.4)' }}
                          onClick={() => handleStartRunner(r.runner_id)}
                        >
                          <Play size={14} /> Start
                        </button>
                      )}
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ color: 'var(--color-error)' }}
                        onClick={() => handleDeleteRunner(r.runner_id)}
                      >
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
  );
}
