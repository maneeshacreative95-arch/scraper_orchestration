import React from 'react';
import DiscoverySearchPanel from './city-discovery/DiscoverySearchPanel';
import PortalValidationTable from './city-discovery/PortalValidationTable';
import UserAssignmentBar from './city-discovery/UserAssignmentBar';
import { extractAgentOptions } from './city-discovery/helpers';
import { useCityDiscovery } from './city-discovery/useCityDiscovery';
import PasswordModal from '../components/PasswordModal';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export default function CityDiscovery({ runners = [], onRefreshStatus }) {
  const {
    promptInput,
    setPromptInput,
    isSearching,
    isExpanding,
    validationResults,
    selectedPortals,
    assignToOtherUser,
    setAssignToOtherUser,
    selectedAgentEmpId,
    setSelectedAgentEmpId,
    isAddingToProcessing,
    statusMessage,
    errorMessage,
    llmInfo,
    pendingAssignPrompt,
    setPendingAssignPrompt,
    handleSearch,
    handleExpandSearchWithAI,
    handleSelectAll,
    isAllSelected,
    handleToggleItem,
    handleAddToProcessing
  } = useCityDiscovery(onRefreshStatus);

  const agentOptions = extractAgentOptions(runners);

  const selectedAgentLabel = agentOptions.find(opt => String(opt.value) === String(selectedAgentEmpId))?.label || `Client ${selectedAgentEmpId}`;

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
            isExpanding={isExpanding}
            handleExpandSearchWithAI={handleExpandSearchWithAI}
          />
        </div>
      )}

      <PasswordModal
        isOpen={pendingAssignPrompt.isOpen}
        onClose={() => setPendingAssignPrompt({ isOpen: false, targetEmpId: null })}
        onConfirm={async (password) => {
          await handleAddToProcessing(password);
        }}
        actionType="assign portals to"
        runnerName={selectedAgentLabel}
      />
    </div>
  );
}
