import React from 'react';

export default function Checkbox({ checked, onChange, disabled, title, className = '', style = {} }) {
  return (
    <div
      role="checkbox"
      aria-checked={checked}
      tabIndex={disabled ? -1 : 0}
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled && onChange) {
          onChange(!checked);
        }
      }}
      onKeyDown={(e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !disabled && onChange) {
          e.preventDefault();
          onChange(!checked);
        }
      }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '18px',
        height: '18px',
        borderRadius: '4px',
        border: checked ? '1px solid #3b82f6' : '1px solid #475569',
        backgroundColor: checked ? '#3b82f6' : (disabled ? 'rgba(30, 41, 59, 0.5)' : '#0f172a'),
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s ease-in-out',
        userSelect: 'none',
        flexShrink: 0,
        ...style
      }}
      className={`custom-react-checkbox ${className}`}
    >
      {checked && (
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ display: 'block' }}
        >
          <polyline points="2 6 4.8 9 10 3" />
        </svg>
      )}
    </div>
  );
}
