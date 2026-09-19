import React from 'react';
import Checkbox from '../../components/Checkbox';

export default function PortalValidationTable({
  validationResults,
  selectedPortals,
  isAllSelected,
  handleSelectAll,
  handleToggleItem
}) {
  return (
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
                <td style={{ color: 'var(--accent-color)', fontWeight: 500 }}>
                  {(res.existing_businesses || 0).toLocaleString()}
                </td>
                <td style={{ color: 'var(--color-success)', fontWeight: 600 }}>
                  {(res.remaining_businesses || 0).toLocaleString()}
                </td>
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
  );
}
