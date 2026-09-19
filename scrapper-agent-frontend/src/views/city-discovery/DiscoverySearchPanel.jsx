import React from 'react';
import { Search, Key } from 'lucide-react';

export default function DiscoverySearchPanel({
  promptInput,
  setPromptInput,
  isSearching,
  handleSearch,
  llmInfo
}) {
  return (
    <div className="panel-card">
      <div className="panel-header" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <h3>Workflow Discovery (LLM First & Distributed Orchestration)</h3>
        <a
          href="https://myblocks.in/api-key-manager"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: '0.85rem',
            color: '#60a5fa',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: 500,
            background: 'rgba(59, 130, 246, 0.1)',
            padding: '6px 12px',
            borderRadius: '6px',
            border: '1px solid rgba(59, 130, 246, 0.3)'
          }}
        >
          <Key size={14} />
          API Key Manager
        </a>
      </div>
      <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem' }}>
        Enter a free-text scraping request. The LLM will discover states/cities, estimate business potential, validate against the Portal Database, and schedule parallel batches.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.25rem', fontSize: '0.8rem' }}>
        <span style={{ color: 'var(--color-text-muted)' }}>LLM Provider:</span>
        <span className="badge badge-completed">{llmInfo?.provider || 'GROQ'}</span>
        <span style={{ color: 'var(--color-text-muted)', marginLeft: '8px' }}>Selected Model:</span>
        <span style={{ color: '#60a5fa', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
          {llmInfo?.model || 'openai/gpt-oss-20b'}
        </span>
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
              Searching Portals...
            </>
          ) : (
            <>
              <Search size={18} />
              Search Portals
            </>
          )}
        </button>
      </form>
    </div>
  );
}

