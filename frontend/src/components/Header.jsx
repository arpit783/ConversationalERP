import React from 'react'
import { NODE_COLORS } from '../constants'

const s = {
  header: {
    background: '#1a1d27', borderBottom: '1px solid #2d3148',
    padding: '0 20px', height: 52, display: 'flex',
    alignItems: 'center', gap: 20, flexShrink: 0,
  },
  logo: { fontSize: 16, fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.3px' },
  dot: { color: '#7F77DD' },
  stats: { display: 'flex', gap: 16, marginLeft: 'auto' },
  stat: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end' },
  statVal: { fontSize: 16, fontWeight: 700, color: '#e2e8f0' },
  statLbl: { fontSize: 10, color: '#5F5E5A', textTransform: 'uppercase', letterSpacing: '0.5px' },
  legend: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  legendItem: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#888780' },
  dot2: (bg) => ({ width: 8, height: 8, borderRadius: 2, background: bg, flexShrink: 0 }),
  ingestBtn: {
    padding: '5px 12px', background: 'none', border: '1px solid #2d3148',
    borderRadius: 6, color: '#5DCAA5', cursor: 'pointer', fontSize: 12,
  },
}

const LEGEND_LABELS = [
  'SalesOrder', 'BillingDocument', 'OutboundDelivery',
  'BusinessPartner', 'Product', 'Plant', 'JournalEntry',
]

export default function Header({ stats, onIngest }) {
  return (
    <div style={s.header}>
      <div style={s.logo}>Conversational<span style={s.dot}>ERP</span></div>

      <div style={s.legend}>
        {LEGEND_LABELS.map(l => (
          <div key={l} style={s.legendItem}>
            <div style={s.dot2(NODE_COLORS[l]?.bg || '#444')} />
            {l.replace(/([A-Z])/g, ' $1').trim()}
          </div>
        ))}
      </div>

      <div style={s.stats}>
        <div style={s.stat}>
          <div style={s.statVal}>{stats?.total_nodes?.toLocaleString() ?? '—'}</div>
          <div style={s.statLbl}>Nodes</div>
        </div>
        <div style={s.stat}>
          <div style={s.statVal}>{stats?.total_edges?.toLocaleString() ?? '—'}</div>
          <div style={s.statLbl}>Edges</div>
        </div>
      </div>

      <button style={s.ingestBtn} onClick={onIngest} title="Load data into Neo4j">
        Ingest data
      </button>
    </div>
  )
}
