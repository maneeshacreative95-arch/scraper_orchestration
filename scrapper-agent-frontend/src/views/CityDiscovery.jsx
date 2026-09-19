import React, { useState } from 'react';
import { apiFetch } from '../api/config';
import DiscoverySearchPanel from './city-discovery/DiscoverySearchPanel';
import PortalValidationTable from './city-discovery/PortalValidationTable';
import UserAssignmentBar from './city-discovery/UserAssignmentBar';
import { CheckCircle2, AlertCircle } from 'lucide-react';

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
      const res = await apiFetch('/api/orchestrate/full-workflow', {
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

      const res = await apiFetch('/api/orchestrate/add-to-processing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setStatusMessage(data.message);
        handleSearch();
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
      <DiscoverySearchPanel
        promptInput={promptInput}
        setPromptInput={setPromptInput}
        isSearching={isSearching}
        handleSearch={handleSearch}
        llmInfo={llmInfo}
      />

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

      {validationResults.length > 0 && (
        <div className="panel-card" style={{ borderColor: 'rgba(16, 185, 129, 0.3)', background: 'rgba(15, 23, 42, 0.6)' }}>
          <div className="panel-header">
            <h3 style={{ color: 'var(--color-success)' }}>Step 2: Portal Database Validation & Queue Scheduling</h3>
          </div>

          <PortalValidationTable
            validationResults={validationResults}
            selectedPortals={selectedPortals}
            isAllSelected={isAllSelected}
            handleSelectAll={handleSelectAll}
            handleToggleItem={handleToggleItem}
          />

          <UserAssignmentBar
            assignToOtherUser={assignToOtherUser}
            setAssignToOtherUser={setAssignToOtherUser}
            selectedAgentEmpId={selectedAgentEmpId}
            setSelectedAgentEmpId={setSelectedAgentEmpId}
            agentOptions={agentOptions}
            isAddingToProcessing={isAddingToProcessing}
            handleAddToProcessing={handleAddToProcessing}
          />
        </div>
      )}
    </div>
  );
}
