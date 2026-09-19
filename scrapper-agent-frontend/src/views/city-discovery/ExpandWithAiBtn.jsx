import React from 'react';
import { Bot } from 'lucide-react';

export default function ExpandWithAiBtn({
  isExpanding,
  handleExpandSearchWithAI,
  disabled
}) {
  return (
    <button
      type="button"
      className="btn btn-secondary"
      disabled={disabled || isExpanding}
      onClick={handleExpandSearchWithAI}
      style={{
        borderRadius: '8px',
        padding: '10px 18px',
        fontSize: '0.9rem',
        fontWeight: 600,
        borderColor: 'rgba(99, 102, 241, 0.4)',
        color: '#818cf8',
        background: 'rgba(99, 102, 241, 0.1)'
      }}
    >
      {isExpanding ? (
        <>
          <span className="spinner-inline"></span>
          AI Expanding...
        </>
      ) : (
        <>
          <Bot size={16} />
          Search More with AI
        </>
      )}
    </button>
  );
}
