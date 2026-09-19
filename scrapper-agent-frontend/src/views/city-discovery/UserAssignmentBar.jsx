import React from 'react';
import Checkbox from '../../components/Checkbox';
import ExpandWithAiBtn from './ExpandWithAiBtn';

export default function UserAssignmentBar({
  assignToOtherUser,
  setAssignToOtherUser,
  selectedAgentEmpId,
  setSelectedAgentEmpId,
  agentOptions,
  isAddingToProcessing,
  handleAddToProcessing,
  isExpanding,
  handleExpandSearchWithAI
}) {
  return (
    <div
      style={{
        marginTop: '1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        background: 'rgba(255, 255, 255, 0.03)',
        padding: '14px 20px',
        borderRadius: '10px',
        border: '1px solid rgba(255, 255, 255, 0.07)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontWeight: 500,
            fontSize: '0.9rem',
            color: '#e2e8f0',
            cursor: 'pointer',
            userSelect: 'none'
          }}
        >
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

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <ExpandWithAiBtn
          isExpanding={isExpanding}
          handleExpandSearchWithAI={handleExpandSearchWithAI}
        />

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
  );
}

