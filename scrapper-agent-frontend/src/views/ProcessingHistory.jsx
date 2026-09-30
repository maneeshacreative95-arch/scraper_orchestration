import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api/config';
import { getAuthContext } from '../utils/auth';
import {
  History,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  PlayCircle,
  AlertTriangle,
  XCircle,
  RotateCcw,
  Ban,
  User,
  ExternalLink
} from 'lucide-react';

export default function ProcessingHistory() {
  const { userId } = getAuthContext();
  const empId = userId || '919';

  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState({ total: 0, done: 0, pending: 0, processing: 0, cancelled: 0, failed: 0 });
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const fetchHistory = useCallback(async (filter = statusFilter, search = searchQuery) => {
    setIsLoading(true);
    setError(null);
    try {
      let url = `/api/scrapper-processing/history?userid=${encodeURIComponent(empId)}`;
      if (filter && filter !== 'ALL') {
        url += `&status=${encodeURIComponent(filter)}`;
      }
      if (search && search.trim()) {
        url += `&search=${encodeURIComponent(search.trim())}`;
      }

      const res = await apiFetch(url);
      const data = await res.json();

      if (res.ok && data.success) {
        setHistory(data.history || []);
        if (data.summary) {
          setSummary(data.summary);
        }
      } else {
        setError(data.error || 'Failed to fetch processing history');
      }
    } catch (err) {
      setError(`Network error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [empId, statusFilter, searchQuery]);

  useEffect(() => {
    fetchHistory(statusFilter, searchQuery);
  }, [statusFilter, searchQuery, fetchHistory]);

  const handleStatusUpdate = async (spId, newStatus) => {
    setActionLoadingId(spId);
    setActionMessage(null);
    try {
      const res = await apiFetch('/api/scrapper-processing/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sp_id: spId, status: newStatus })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionMessage(`Task #${spId} marked as ${newStatus}.`);
        setTimeout(() => setActionMessage(null), 4000);
        fetchHistory();
      } else {
        alert(data.error || 'Failed to update status');
      }
    } catch (err) {
      alert(`Error updating task: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const getStatusBadge = (status) => {
    const s = String(status || '').toUpperCase();
    if (s === 'DONE' || s === 'COMPLETED') {
      return <span className="badge badge-completed">Done</span>;
    }
    if (s === 'PROCESSING') {
      return <span className="badge badge-running" style={{ animation: 'pulse 1.5s infinite' }}>Processing</span>;
    }
    if (s === 'PENDING') {
      return <span className="badge badge-pending">Pending</span>;
    }
    if (s === 'CANCELLED') {
      return <span className="badge badge-offline">Cancelled</span>;
    }
    if (s === 'FAILED') {
      return <span className="badge badge-failed">Failed</span>;
    }
    return <span className="badge">{status}</span>;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return String(dateStr);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header & Controls Panel */}
      <div className="panel-card">
        <div className="panel-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <History size={24} style={{ color: '#3b82f6' }} />
              <h2>SCRAPPER_PROCESSING User History</h2>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              Your database queue tasks from SCRAPPER_PROCESSING table.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(59, 130, 246, 0.1)',
              padding: '6px 14px',
              borderRadius: '20px',
              border: '1px solid rgba(59, 130, 246, 0.25)'
            }}>
              <User size={15} style={{ color: '#60a5fa' }} />
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Logged-in User:</span>
              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#60a5fa' }}>{empId}</span>
            </div>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => fetchHistory()}
              disabled={isLoading}
              title="Refresh queue"
            >
              <RefreshCw size={14} className={isLoading ? 'spin-icon' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Metric Cards Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          marginTop: '1rem'
        }}>
          <div
            onClick={() => setStatusFilter('ALL')}
            style={{
              background: statusFilter === 'ALL' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.02)',
              border: `1px solid ${statusFilter === 'ALL' ? '#3b82f6' : 'var(--border-card)'}`,
              borderRadius: '12px',
              padding: '1rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Tasks</span>
              <History size={16} style={{ color: '#3b82f6' }} />
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#fff' }}>{summary.total}</div>
          </div>

          <div
            onClick={() => setStatusFilter('DONE')}
            style={{
              background: statusFilter === 'DONE' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.02)',
              border: `1px solid ${statusFilter === 'DONE' ? '#10b981' : 'var(--border-card)'}`,
              borderRadius: '12px',
              padding: '1rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Completed</span>
              <CheckCircle2 size={16} style={{ color: '#10b981' }} />
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#10b981' }}>{summary.done}</div>
          </div>

          <div
            onClick={() => setStatusFilter('PENDING')}
            style={{
              background: statusFilter === 'PENDING' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.02)',
              border: `1px solid ${statusFilter === 'PENDING' ? '#f59e0b' : 'var(--border-card)'}`,
              borderRadius: '12px',
              padding: '1rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pending</span>
              <Clock size={16} style={{ color: '#f59e0b' }} />
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#f59e0b' }}>{summary.pending}</div>
          </div>

          <div
            onClick={() => setStatusFilter('PROCESSING')}
            style={{
              background: statusFilter === 'PROCESSING' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.02)',
              border: `1px solid ${statusFilter === 'PROCESSING' ? '#60a5fa' : 'var(--border-card)'}`,
              borderRadius: '12px',
              padding: '1rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Processing</span>
              <PlayCircle size={16} style={{ color: '#60a5fa' }} />
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#60a5fa' }}>{summary.processing}</div>
          </div>

          <div
            onClick={() => setStatusFilter('CANCELLED')}
            style={{
              background: statusFilter === 'CANCELLED' ? 'rgba(156, 163, 175, 0.2)' : 'rgba(255, 255, 255, 0.02)',
              border: `1px solid ${statusFilter === 'CANCELLED' ? '#9ca3af' : 'var(--border-card)'}`,
              borderRadius: '12px',
              padding: '1rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cancelled / Failed</span>
              <Ban size={16} style={{ color: '#9ca3af' }} />
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#e5e7eb' }}>{summary.cancelled + summary.failed}</div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {actionMessage && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          padding: '12px 18px',
          borderRadius: '10px',
          color: '#10b981',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.9rem'
        }}>
          <CheckCircle2 size={18} />
          <span>{actionMessage}</span>
        </div>
      )}

      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          padding: '12px 18px',
          borderRadius: '10px',
          color: '#f87171',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.9rem'
        }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Table Panel */}
      <div className="panel-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '240px', maxWidth: '420px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              className="input-style"
              style={{ width: '100%', paddingLeft: '36px' }}
              placeholder="Search portal name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}
              >
                <XCircle size={16} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Status Filter:</span>
            {['ALL', 'PENDING', 'DONE', 'PROCESSING', 'CANCELLED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`btn btn-sm ${statusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
                style={{ textTransform: 'capitalize', fontSize: '0.75rem', padding: '4px 10px' }}
              >
                {st.toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Data Table */}
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '80px' }}>SP ID</th>
                <th>Portal Name</th>
                <th>Portal ID</th>
                <th>User (Emp ID)</th>
                <th>Status</th>
                <th>Queued At</th>
                <th>Last Updated</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
                    <RefreshCw size={24} className="spin-icon" style={{ margin: '0 auto 12px' }} />
                    <p>Loading SCRAPPER_PROCESSING history for User {empId}...</p>
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--color-text-muted)' }}>
                    <History size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                    <p style={{ fontSize: '1rem', fontWeight: '600', color: '#fff' }}>No history records found</p>
                    <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                      {searchQuery || statusFilter !== 'ALL'
                        ? 'Try clearing the search or status filter.'
                        : `No portals found in SCRAPPER_PROCESSING for Employee ID ${empId}.`}
                    </p>
                  </td>
                </tr>
              ) : (
                history.map((row) => {
                  const currentStatus = String(row.status || row.STATUS || '').toUpperCase();
                  const isRowLoading = actionLoadingId === (row.sp_id || row.SP_ID);

                  return (
                    <tr key={row.sp_id || row.SP_ID}>
                      <td style={{ fontWeight: '600', color: 'var(--color-text-muted)' }}>
                        #{row.sp_id || row.SP_ID}
                      </td>
                      <td style={{ fontWeight: '600', color: '#fff' }}>
                        {row.portal_name || row.PORTALNAME || 'Unknown'}
                        {row.portal_areas ? (
                          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block' }}>
                            {row.portal_areas}
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          background: 'rgba(255, 255, 255, 0.05)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '0.8rem'
                        }}>
                          {row.portal_id || row.PORTALID}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: '#93c5fd', fontWeight: '500' }}>
                          {row.emp_id || row.EMP_ID}
                        </span>
                      </td>
                      <td>{getStatusBadge(currentStatus)}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                        {formatDate(row.insert_dtm || row.INSRT_DTM)}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                        {formatDate(row.update_dtm || row.UPDATE_DTM)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          {(currentStatus === 'CANCELLED' || currentStatus === 'FAILED') && (
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '4px 8px', fontSize: '0.72rem', color: '#10b981' }}
                              onClick={() => handleStatusUpdate(row.sp_id || row.SP_ID, 'PENDING')}
                              disabled={isRowLoading}
                              title="Re-queue task back to PENDING"
                            >
                              <RotateCcw size={12} className={isRowLoading ? 'spin-icon' : ''} />
                              <span>Re-queue</span>
                            </button>
                          )}

                          {currentStatus === 'PENDING' && (
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '4px 8px', fontSize: '0.72rem', color: '#f87171' }}
                              onClick={() => handleStatusUpdate(row.sp_id || row.SP_ID, 'CANCELLED')}
                              disabled={isRowLoading}
                              title="Cancel pending task"
                            >
                              <Ban size={12} className={isRowLoading ? 'spin-icon' : ''} />
                              <span>Cancel</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-card)', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
          <span>Showing {history.length} record(s) for User ID {empId}</span>
          <span>Database table: <code>SCRAPPER_PROCESSING</code></span>
        </div>
      </div>
    </div>
  );
}
