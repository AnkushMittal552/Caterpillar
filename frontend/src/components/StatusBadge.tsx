import React from 'react';

interface StatusBadgeProps {
  status: string;
  type?: 'task' | 'machine' | 'seatbelt' | 'incident' | 'severity' | 'category' | 'general';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type = 'general' }) => {
  const normalized = status.toUpperCase().replace(/\s+/g, '_');
  
  let pillClass = 'status-pill';
  let label = status;

  // Task & Lifecycle Statuses
  if (normalized === 'OPERATIONAL' || normalized === 'FASTENED' || normalized === 'COMPLETED' || normalized === 'RESOLVED') {
    pillClass += ' operational';
    if (normalized === 'RESOLVED') label = 'Resolved';
    if (normalized === 'COMPLETED') label = 'Completed';
  } else if (normalized === 'IN_PROGRESS' || normalized === 'ACTIVE') {
    pillClass += normalized === 'ACTIVE' && type === 'incident' ? ' alert' : ' in_progress';
    label = normalized === 'IN_PROGRESS' ? 'In Progress' : 'Active';
  } else if (normalized === 'PAUSED') {
    pillClass += ' warning';
    label = 'Paused';
  } else if (normalized === 'ACKNOWLEDGED') {
    pillClass += ' acknowledged';
    label = 'Acknowledged';
  } else if (normalized === 'PENDING') {
    pillClass += ' pending';
    label = 'Pending';
  } else if (normalized === 'UNFASTENED' || normalized === 'CRITICAL' || normalized === 'DANGER' || normalized === 'OFFLINE') {
    pillClass += ' unfastened';
    if (normalized === 'CRITICAL') label = 'Critical';
  } else if (normalized === 'HIGH') {
    pillClass += ' high-severity';
    label = 'High';
  } else if (normalized === 'MEDIUM') {
    pillClass += ' medium-severity';
    label = 'Medium';
  } else if (normalized === 'INFO') {
    pillClass += ' info-severity';
    label = 'Info';
  } else if (type === 'category') {
    pillClass += ' category-tag';
    label = status.toUpperCase();
  } else {
    pillClass += ' pending';
  }

  return (
    <span className={pillClass} data-testid={`status-${type}`}>
      {label}
    </span>
  );
};
