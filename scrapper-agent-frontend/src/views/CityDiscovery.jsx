import React, { useState, useEffect } from 'react';
import Checkbox from '../components/Checkbox';
import { Search, Plus, UserPlus, CheckCircle2, AlertCircle } from 'lucide-react';

export default function CityDiscovery({ runners = [], onRefreshStatus }) {
  const [promptInput, setPromptInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [validationResults, setValidationResults] = useState([]);
  const [selectedPortals, setSelectedPortals] = useState({});
  const [assignToOtherUser, setAssignToOtherUser] = useState(false);
  const [selectedAgentEmpId, setSelectedAgentEmpId] = useState('');
  const [isAddingToProcessing, setIsAddingToProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [llmInfo, setLlmInfo] = useState({ provider: 'GROQ', model: 'openai/gpt-oss-20b' });

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!promptInput.trim()) return;

    setIsSearching(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/orchestrate/full-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptInput })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setValidationResults(data.validation || []);
        setSelectedPortals({});
        setStatusMessage(`Successfully discovered ${data.validation?.length || 0} location portal records.`);
        if (data.llm_info) setLlmInfo(data.llm_info);
      } else {
        setErrorMessage(data.error || 'Failed to execute region discovery search.');
      }
    } catch (err) {
      setErrorMessage(`Server communication error: ${err.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectAll = (checked) => {
    const updated = {};
    validationResults.forEach((item, idx) => {
      if (!item.already_in_processing) {
        updated[idx] = checked;
      }
    });
    setSelectedPortals(updated);
  };

  const isAllSelected = () => {
    const selectableIndices = validationResults
      .map((item, idx) => (!item.already_in_processing ? idx : null))
      .filter((i) => i !== null);

    if (selectableIndices.length === 0) return false;
    return selectableIndices.every((idx) => selectedPortals[idx]);
  };

  const handleToggleItem = (idx, checked) => {
    setSelectedPortals((prev) => ({ ...prev, [idx]: checked }));
  };

  const handleAddToProcessing = async () => {
    const selectedIndices = Object.keys(selectedPortals).filter((k) => selectedPortals[k]);
    if (selectedIndices.length === 0) {
      alert('Please select at least one portal checkbox to add to SCRAPPER_PROCESSING.');
      return;
    }

    if (assignToOtherUser && !selectedAgentEmpId) {
      alert('Please select an agent from the Agent Registry dropdown before adding to SCRAPPER_PROCESSING.');
      return;
    }

    const itemsToAdd = selectedIndices.map((idx) => {
      const item = validationResults[idx];
      return {
        portal_id: item.portal_id,
        city: item.city,
        state: item.state
      };
    });

    setIsAddingToProcessing(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const payload = { items: itemsToAdd };
      if (assignToOtherUser && selectedAgentEmpId) {
        payload.target_emp_id = selectedAgentEmpId;
      }

      const res = await fetch('/api/orchestrate/add-to-processing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setStatusMessage(data.message);
        handleSearch(); // Refresh search validation
        if (onRefreshStatus) onRefreshStatus();
      } else {
        setErrorMessage(data.error || 'Failed to add selected portals to SCRAPPER_PROCESSING.');
      }
    } catch (err) {
      setErrorMessage(`Error adding to processing: ${err.message}`);
    } finally {
      setIsAddingToProcessing(false);
    }
  };

  // Unique list of agents from runners prop
  const agentOptions = Array.from(
    new Map(
      runners.map((r) => {
        let empId = r.client_id || r.emp_id;
        if (!empId && r.runner_id && r.runner_id.startsWith('runner_')) {
          const parts = r.runner_id.split('_');
          if (parts[1] && !isNaN(parseInt(parts[1], 10))) empId = parseInt(parts[1], 10);
        }
        if (!empId) empId = 1572;

        const displayName = r.agent_name || r.server_name || `Runner ${r.runner_id || ''}`;
        return [empId, { empId, displayName }];
      })
    ).values()
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Search Panel */}
      <div className="panel-card">
        <div className="panel-header" style={{ marginBottom: '1rem' }}>
          <h3>Workflow Discovery (LLM First & Distributed Orchestration)</h3>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem' }}>
          Enter a free-text scraping request. The LLM will discover states/cities, estimate business potential, validate against the Portal Database, and schedule parallel batches.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.25rem', fontSize: '0.8rem' }}>
          <span style={{ color: 'var(--color-text-muted)' }}>LLM Provider:</span>
          <span className="badge badge-completed">{llmInfo.provider}</span>
          <span style={{ color: 'var(--color-text-muted)', marginLeft: '8px' }}>Selected Model:</span>
          <span style={{ color: '#60a5fa', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{llmInfo.model}</span>
        </div>

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '1rem' }}>
          <textarea
            className="input-style"
            style={{ flex: 1, height: '80px', resize: 'vertical', fontSize: '0.95rem' }}
            placeholder='e.g. "Run healthcare companies across South India" or "Run AI startups across Entire India"'
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSearching || !promptInput.trim()}
            style={{ padding: '0 28px', height: '80px', borderRadius: '12px', fontSize: '1rem' }}
          >
            {isSearching ? (
              <>
                <span className="spinner-inline"></span>
                Searching...
              </>
            ) : (
              <>
                <Search size={18} />
                Analyze & Orchestrate
              </>
            )}
          </button>
        </form>
      </div>

      {/* Messages */}
      {statusMessage && (
        <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '12px 18px', borderRadius: '10px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
          <CheckCircle2 size={18} />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '12px 18px', borderRadius: '10px', color: '#f87171', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
          <AlertCircle size={18} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Step 2 Validation Panel */}
      {validationResults.length > 0 && (
        <div className="panel-card" style={{ borderColor: 'rgba(16, 185, 129, 0.3)', background: 'rgba(15, 23, 42, 0.6)' }}>
          <div className="panel-header">
            <h3 style={{ color: 'var(--color-success)' }}>Step 2: Portal Database Validation & Queue Scheduling</h3>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <Checkbox
                      checked={isAllSelected()}
                      onChange={handleSelectAll}
                      title="Select/Deselect All Available Portals"
                    />
                  </th>
                  <th>STATE</th>
                  <th>CITY / TOWN</th>
                  <th>ESTIMATED BUSINESSES</th>
                  <th>EXISTING BUSINESSES</th>
                  <th>REMAINING BUSINESSES</th>
                  <th>PORTAL ID</th>
                  <th>VALIDATION STATUS</th>
                </tr>
              </thead>
              <tbody>
                {validationResults.map((res, idx) => {
                  const isBlocked = res.already_in_processing;
                  let badgeClass = 'badge-pending';
                  let statusText = res.status;

                  if (isBlocked) {
                    badgeClass = 'badge-failed';
                    statusText = 'Already in Processing';
                  } else if (res.status === 'Completed') {
                    badgeClass = 'badge-completed';
                  } else if (res.status === 'Partial') {
                    badgeClass = 'badge-running';
                  }

                  return (
                    <tr key={idx} style={{ opacity: isBlocked ? 0.7 : 1 }}>
                      <td style={{ textAlign: 'center' }}>
                        <Checkbox
                          checked={Boolean(selectedPortals[idx])}
                          disabled={isBlocked}
                          onChange={(checked) => handleToggleItem(idx, checked)}
                          title={isBlocked ? `Portal '${res.city}' is already in SCRAPPER_PROCESSING. Contact admin.` : ''}
                        />
                      </td>
                      <td><strong>{res.state}</strong></td>
                      <td>{res.city}</td>
                      <td>{(res.estimated_businesses || 0).toLocaleString()}</td>
                      <td style={{ color: 'var(--accent-color)', fontWeight: 500 }}>{(res.existing_businesses || 0).toLocaleString()}</td>
                      <td style={{ color: 'var(--color-success)', fontWeight: 600 }}>{(res.remaining_businesses || 0).toLocaleString()}</td>
                      <td><code>{res.portal_id || '-'}</code></td>
                      <td>
                        <span className={`badge ${badgeClass}`}>{statusText}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* User Assignment Controls */}
          <div style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', background: 'rgba(255, 255, 255, 0.03)', padding: '14px 20px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.07)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 500, fontSize: '0.9rem', color: '#e2e8f0', cursor: 'pointer', userSelect: 'none' }}>
                <Checkbox
                  checked={assignToOtherUser}
                  onChange={(checked) => setAssignToOtherUser(checked)}
                />
                <span>Assign selected city/cities to another user?</span>
              </label>

              {assignToOtherUser && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <select
                    className="input-style"
                    value={selectedAgentEmpId}
                    onChange={(e) => setSelectedAgentEmpId(e.target.value)}
                    style={{ background: '#1e293b', borderColor: '#3b82f6', minWidth: '240px' }}
                  >
                    <option value="">-- Select Agent from Registry --</option>
                    {agentOptions.map((opt) => (
                      <option key={opt.empId} value={opt.empId}>
                        {opt.displayName} [EMP ID: {opt.empId}]
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <button
              className="btn btn-primary"
              disabled={isAddingToProcessing}
              onClick={handleAddToProcessing}
              style={{ borderRadius: '8px', padding: '10px 24px', fontSize: '0.95rem', fontWeight: 600 }}
            >
              {isAddingToProcessing ? (
                <>
                  <span className="spinner-inline"></span>
                  Adding to Processing...
                </>
              ) : (
                'Add Selected Portals to SCRAPPER_PROCESSING'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
