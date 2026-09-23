import React from 'react';
import { Activity, Gauge, Fuel, Repeat, Clock, AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react';
import type { TelemetrySnapshot, UsageInsight, Incident } from '../types';

interface TelemetryPageProps {
  telemetry: TelemetrySnapshot;
  insights: UsageInsight[];
  incidents: Incident[];
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
}

export const TelemetryPage: React.FC<TelemetryPageProps> = ({
  telemetry,
  insights,
  incidents,
  onRefresh,
  isRefreshing,
}) => {
  const usageIncidents = incidents.filter(
    (inc) =>
      inc.category === 'PRODUCTIVITY' ||
      inc.type === 'HIGH_IDLE' ||
      inc.incident_type === 'HIGH_IDLE'
  );

  return (
    <div className="page-container" style={{ padding: '24px 0' }}>
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#F3F4F6', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Activity size={24} color="#EAB308" />
            Machine Telemetry & Operational Insights
          </h2>
          <p style={{ margin: '4px 0 0 0', color: '#9CA3AF', fontSize: 14 }}>
            Live sensor metrics, explainable usage analysis, and productivity evaluations.
          </p>
        </div>
        <button
          className="btn btn-secondary"
          onClick={onRefresh}
          disabled={isRefreshing}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <RefreshCw size={16} className={isRefreshing ? 'spin' : ''} />
          {isRefreshing ? 'Refreshing...' : 'Refresh Telemetry'}
        </button>
      </div>

      {/* 1. Live Telemetry Metrics Grid */}
      <h3 style={{ fontSize: 16, color: '#D1D5DB', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Current Sensor Telemetry
      </h3>
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        <div className="stat-card" style={{ background: '#1F2937', padding: 16, borderRadius: 8, border: '1px solid #374151' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9CA3AF', fontSize: 13, marginBottom: 8 }}>
            <Gauge size={18} color="#EAB308" />
            <span>Engine Hours</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#F9FAFB' }}>
            {telemetry.engine_hours.toFixed(1)} <span style={{ fontSize: 14, fontWeight: 400, color: '#9CA3AF' }}>hrs</span>
          </div>
        </div>

        <div className="stat-card" style={{ background: '#1F2937', padding: 16, borderRadius: 8, border: '1px solid #374151' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9CA3AF', fontSize: 13, marginBottom: 8 }}>
            <Fuel size={18} color="#3B82F6" />
            <span>Fuel Used</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#F9FAFB' }}>
            {telemetry.fuel_used.toFixed(1)} <span style={{ fontSize: 14, fontWeight: 400, color: '#9CA3AF' }}>L</span>
          </div>
        </div>

        <div className="stat-card" style={{ background: '#1F2937', padding: 16, borderRadius: 8, border: '1px solid #374151' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9CA3AF', fontSize: 13, marginBottom: 8 }}>
            <Repeat size={18} color="#10B981" />
            <span>Load Cycles</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#F9FAFB' }}>
            {telemetry.load_cycles} <span style={{ fontSize: 14, fontWeight: 400, color: '#9CA3AF' }}>cycles</span>
          </div>
        </div>

        <div className="stat-card" style={{ background: '#1F2937', padding: 16, borderRadius: 8, border: '1px solid #374151' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9CA3AF', fontSize: 13, marginBottom: 8 }}>
            <Clock size={18} color={telemetry.idle_minutes > 45 ? '#EF4444' : '#F59E0B'} />
            <span>Idle Time</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: telemetry.idle_minutes > 45 ? '#EF4444' : '#F9FAFB' }}>
            {telemetry.idle_minutes} <span style={{ fontSize: 14, fontWeight: 400, color: '#9CA3AF' }}>min</span>
          </div>
        </div>
      </div>

      {/* 2. Explainable Usage Insights */}
      <div style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 16, color: '#D1D5DB', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Explainable Usage Insights
        </h3>

        {insights.length === 0 ? (
          <div style={{ background: '#1F2937', border: '1px solid #374151', borderRadius: 8, padding: 24, textAlign: 'center', color: '#9CA3AF' }}>
            <ShieldCheck size={32} color="#10B981" style={{ margin: '0 auto 8px auto', display: 'block' }} />
            <p style={{ margin: 0, fontWeight: 600, color: '#F3F4F6' }}>No adverse usage anomalies observed</p>
            <p style={{ margin: '4px 0 0 0', fontSize: 13 }}>Current telemetry aligns within expected baseline boundaries.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {insights.map((insight, idx) => (
              <div
                key={idx}
                className="insight-card"
                style={{
                  background: '#1F2937',
                  border: `1px solid ${insight.severity === 'HIGH' ? '#EF4444' : insight.severity === 'MEDIUM' ? '#F59E0B' : '#3B82F6'}`,
                  borderRadius: 8,
                  padding: 20,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertTriangle size={20} color={insight.severity === 'HIGH' ? '#EF4444' : '#F59E0B'} />
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#F9FAFB' }}>
                      {insight.type.replace(/_/g, ' ')}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: 'rgba(255,255,255,0.08)',
                        color: '#D1D5DB',
                      }}
                    >
                      {insight.category}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: insight.severity === 'HIGH' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                      color: insight.severity === 'HIGH' ? '#F87171' : '#FBBF24',
                    }}
                  >
                    {insight.severity} SEVERITY
                  </span>
                </div>

                <p style={{ margin: '0 0 16px 0', fontSize: 14, color: '#E5E7EB', lineHeight: 1.5 }}>
                  {insight.message}
                </p>

                {/* Evidence Breakdown */}
                {insight.evidence && Object.keys(insight.evidence).length > 0 && (
                  <div style={{ background: '#111827', borderRadius: 6, padding: '12px 16px', border: '1px solid #374151' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', marginBottom: 8, textTransform: 'uppercase' }}>
                      Observed Evidence & Comparison Baseline
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, fontSize: 13 }}>
                      {Object.entries(insight.evidence).map(([key, value]) => (
                        <div key={key}>
                          <span style={{ color: '#9CA3AF', display: 'block', fontSize: 11 }}>
                            {key.replace(/_/g, ' ')}:
                          </span>
                          <span style={{ color: '#F3F4F6', fontWeight: 600 }}>{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Recent Usage-Related Incidents */}
      <div>
        <h3 style={{ fontSize: 16, color: '#D1D5DB', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Recent Usage & Productivity Incidents
        </h3>
        {usageIncidents.length === 0 ? (
          <p style={{ color: '#9CA3AF', fontSize: 14 }}>No productivity incidents recorded.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {usageIncidents.map((inc) => (
              <div
                key={inc.id}
                style={{
                  background: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: 6,
                  padding: '12px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, color: '#F3F4F6' }}>{inc.title}</span>
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>({inc.status})</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#9CA3AF' }}>{inc.message}</div>
                </div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>
                  {new Date(inc.created_at).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
