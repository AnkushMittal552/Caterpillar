import React from 'react';

interface StatusBadgeProps {
  status: string;
  type?: 'task' | 'machine' | 'seatbelt' | 'general';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type = 'general' }) => {
  const normalized = status.toUpperCase().replace(/\s+/g, '_');
  
  let pillClass = 'status-pill';
  let label = status;

  if (normalized === 'OPERATIONAL' || normalized === 'FASTENED' || normalized === 'COMPLETED') {
    pillClass += ' operational';
  } else if (normalized === 'IN_PROGRESS' || normalized === 'ACTIVE') {
    pillClass += ' in_progress';
    label = 'In Progress';
  } else if (normalized === 'PENDING') {
    pillClass += ' pending';
    label = 'Pending';
  } else if (normalized === 'UNFASTENED' || normalized === 'ALERT' || normalized === 'DANGER' || normalized === 'OFFLINE') {
    pillClass += ' unfastened';
  } else {
    pillClass += ' pending';
  }

  return (
    <span className={pillClass} data-testid={`status-${type}`}>
      {label}
    </span>
  );
};
