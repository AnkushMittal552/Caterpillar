import React from 'react';

interface EvidenceListProps {
  evidence?: Record<string, unknown> | Array<{ key?: string; label?: string; value: unknown }> | unknown;
}

export const EvidenceList: React.FC<EvidenceListProps> = ({ evidence }) => {
  if (!evidence) {
    return null;
  }

  const renderItems = () => {
    if (typeof evidence === 'object' && evidence !== null) {
      if (Array.isArray(evidence)) {
        return evidence.map((item, idx) => {
          if (typeof item === 'object' && item !== null) {
            const key = item.key || item.label || `Metric ${idx + 1}`;
            const val = item.value !== undefined ? String(item.value) : JSON.stringify(item);
            return (
              <div key={idx} className="evidence-row">
                <span className="evidence-key">{key}:</span>
                <span className="evidence-value">{val}</span>
              </div>
            );
          }
          return (
            <div key={idx} className="evidence-row">
              <span className="evidence-value">{String(item)}</span>
            </div>
          );
        });
      }

      // Plain key-value dictionary
      return Object.entries(evidence as Record<string, unknown>).map(([key, val]) => (
        <div key={key} className="evidence-row">
          <span className="evidence-key">{key}:</span>
          <span className="evidence-value">
            {typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val)}
          </span>
        </div>
      ));
    }

    return (
      <div className="evidence-row">
        <span className="evidence-value">{String(evidence)}</span>
      </div>
    );
  };

  return (
    <div className="incident-evidence-box">
      <div className="evidence-header">Evidence:</div>
      <div className="evidence-list">{renderItems()}</div>
    </div>
  );
};
