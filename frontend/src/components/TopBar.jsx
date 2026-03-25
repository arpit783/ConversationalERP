import React, { useState } from 'react'
import { NODE_COLORS } from '../constants'

const NODE_TYPE_COLORS = Object.fromEntries(Object.entries(NODE_COLORS).map(([k, v]) => [k, v.bg]))

// O2C process flow steps for the top bar indicator
const O2C_STEPS = [
  { key: 'SalesOrder', label: 'Sales Order' },
  { key: 'OutboundDelivery', label: 'Delivery' },
  { key: 'BillingDocument', label: 'Billing' },
  { key: 'JournalEntry', label: 'Journal' },
  { key: 'Payment', label: 'Payment' },
]

export default function TopBar({ stats, onIngest, chatOpen, onToggleChat }) {
  const [showBreakdown, setShowBreakdown] = useState(false)
  const hasData = stats && stats.total_nodes > 0
  const nodeCounts = stats?.node_counts || []
  const countMap = Object.fromEntries(nodeCounts.map(n => [n.label, n.count]))

  return (
    <div style={{
      height: 52, background: '#fff', borderBottom: '1px solid #e5e7eb',
      display: 'flex', alignItems: 'center', padding: '0 18px',
      gap: 10, flexShrink: 0, position: 'relative', zIndex: 30,
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      {/* Hamburger */}
      <button style={{
        width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: 'none', background: 'none', cursor: 'pointer', borderRadius: 6, color: '#6b7280',
      }}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <rect x="2" y="4" width="14" height="1.5" rx="1" fill="currentColor"/>
          <rect x="2" y="8.25" width="14" height="1.5" rx="1" fill="currentColor"/>
          <rect x="2" y="12.5" width="14" height="1.5" rx="1" fill="currentColor"/>
        </svg>
      </button>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 13, color: '#9ca3af', cursor: 'pointer' }}>Mapping</span>
        <span style={{ color: '#d1d5db', fontSize: 16 }}>/</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#111827', letterSpacing: '-0.01em' }}>
          Order to Cash
        </span>
      </div>

      <div style={{ width: 1, height: 22, background: '#e5e7eb', margin: '0 4px' }} />

      {/* O2C Process flow pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        {O2C_STEPS.map((step, i) => {
          const count = countMap[step.key]
          const active = count > 0
          return (
            <React.Fragment key={step.key}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: active ? NODE_TYPE_COLORS[step.key] || '#e5e7eb' : '#f3f4f6',
                border: `1px solid ${active ? NODE_COLORS[step.key]?.border || '#d1d5db' : '#e5e7eb'}`,
                borderRadius: 20, padding: '2px 9px',
                opacity: active ? 1 : 0.5,
                transition: 'all 0.2s',
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: active ? NODE_COLORS[step.key]?.border || '#6b7280' : '#d1d5db',
                }} />
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  color: active ? NODE_COLORS[step.key]?.text || '#374151' : '#9ca3af',
                }}>
                  {step.label}
                  {active && count && (
                    <span style={{ fontWeight: 400, marginLeft: 4 }}>
                      {count > 999 ? `${(count/1000).toFixed(1)}k` : count}
                    </span>
                  )}
                </span>
              </div>
              {i < O2C_STEPS.length - 1 && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0, opacity: 0.4 }}>
                  <path d="M3 2l4 3-4 3" stroke="#9ca3af" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </React.Fragment>
          )
        })}
      </div>

      <div style={{ flex: 1 }} />

      {/* Status pill */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: hasData ? '#f0fdf4' : '#f3f4f6',
        border: `1px solid ${hasData ? '#bbf7d0' : '#e5e7eb'}`,
        borderRadius: 20, padding: '4px 12px',
        fontSize: 11, color: hasData ? '#16a34a' : '#6b7280',
        fontWeight: 500,
      }}>
        <div style={{
          width: 7, height: 7, borderRadius: '50%',
          background: hasData ? '#22c55e' : '#d1d5db',
        }} />
        {hasData ? `${stats.total_nodes.toLocaleString()} nodes · ${stats.total_edges.toLocaleString()} edges` : 'No data'}
      </div>

      <div style={{ width: 1, height: 24, background: '#e5e7eb' }} />

      {/* Stats breakdown hover */}
      <div
        style={{ position: 'relative', display: 'flex', gap: 12, cursor: 'default' }}
        onMouseEnter={() => setShowBreakdown(true)}
        onMouseLeave={() => setShowBreakdown(false)}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 44 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', lineHeight: 1 }}>
            {stats?.total_nodes?.toLocaleString() ?? '—'}
          </div>
          <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>nodes</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 44 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', lineHeight: 1 }}>
            {stats?.total_edges?.toLocaleString() ?? '—'}
          </div>
          <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>edges</div>
        </div>

        {/* Breakdown tooltip */}
        {showBreakdown && nodeCounts.length > 0 && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 10px)', right: 0,
            background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
            padding: '12px 16px', minWidth: 220, zIndex: 100,
          }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: '#374151', marginBottom: 10,
              textTransform: 'uppercase', letterSpacing: '0.07em',
            }}>
              Node breakdown
            </div>
            {nodeCounts.map(({ label, count }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                  background: NODE_TYPE_COLORS[label] || '#e5e7eb',
                  border: `1.5px solid ${NODE_COLORS[label]?.border || '#d1d5db'}`,
                }} />
                <span style={{ fontSize: 12, color: '#374151', flex: 1 }}>{label}</span>
                <span style={{
                  fontSize: 12, fontWeight: 700, color: '#111827',
                  background: '#f3f4f6', borderRadius: 8, padding: '1px 7px',
                }}>
                  {count?.toLocaleString()}
                </span>
              </div>
            ))}
            {stats?.edge_counts?.length > 0 && (
              <>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: '#374151', marginTop: 10, marginBottom: 8,
                  textTransform: 'uppercase', letterSpacing: '0.07em', borderTop: '1px solid #f3f4f6', paddingTop: 8,
                }}>
                  Edge types
                </div>
                {stats.edge_counts.slice(0, 8).map(({ type, count }) => (
                  <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <div style={{ width: 14, height: 1.5, background: '#bfdbfe', borderRadius: 1, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: '#6b7280', flex: 1, fontFamily: 'monospace' }}>{type}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7280' }}>{count?.toLocaleString()}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      <div style={{ width: 1, height: 24, background: '#e5e7eb' }} />

      {/* Chat toggle — label flips between "Hide Chat" and "Show Chat" */}
      <button
        onClick={onToggleChat}
        style={{
          padding: '6px 13px',
          background: chatOpen ? '#111827' : '#fff',
          border: `1px solid ${chatOpen ? '#111827' : '#e5e7eb'}`,
          borderRadius: 8, color: chatOpen ? '#fff' : '#374151',
          cursor: 'pointer', fontSize: 12, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 6,
          transition: 'all 0.15s',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 2h10a1 1 0 011 1v6a1 1 0 01-1 1H8l-3 2v-2H2a1 1 0 01-1-1V3a1 1 0 011-1z"
            stroke="currentColor" strokeWidth="1.2" fill="none"/>
        </svg>
        {chatOpen ? 'Hide Chat' : 'Show Chat'}
      </button>

      {/* Load data */}
      <button
        onClick={onIngest}
        style={{
          padding: '6px 14px',
          background: 'linear-gradient(135deg,#1a1a2e 0%,#16213e 60%,#0f3460 100%)',
          border: 'none', borderRadius: 8, color: '#fff',
          cursor: 'pointer', fontSize: 12, fontWeight: 600,
          boxShadow: '0 2px 8px rgba(15,52,96,0.3)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M6 1v7M3 5l3 3 3-3" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M1 10h10" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        Load data
      </button>
    </div>
  )
}
