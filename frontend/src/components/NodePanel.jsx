import React from 'react'
import { NODE_COLORS, DEFAULT_NODE_COLOR } from '../constants'

const s = {
  panel: {
    width: 280, background: '#1a1d27', borderLeft: '1px solid #2d3148',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  header: {
    padding: '12px 16px', borderBottom: '1px solid #2d3148',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  title: { fontSize: 13, fontWeight: 600, color: '#e2e8f0' },
  closeBtn: {
    background: 'none', border: 'none', color: '#888780',
    cursor: 'pointer', fontSize: 18, lineHeight: 1,
  },
  badge: {
    display: 'inline-block', padding: '2px 8px', borderRadius: 4,
    fontSize: 11, fontWeight: 600, marginBottom: 12,
  },
  body: { padding: 16, overflowY: 'auto', flex: 1 },
  row: { marginBottom: 10 },
  key: { fontSize: 11, color: '#888780', marginBottom: 2 },
  val: {
    fontSize: 12, color: '#e2e8f0', background: '#0f1117',
    padding: '4px 8px', borderRadius: 4, wordBreak: 'break-all',
  },
  expandBtn: {
    width: '100%', marginTop: 16, padding: '8px 0',
    background: '#2d3148', border: '1px solid #444', borderRadius: 6,
    color: '#a5b4fc', cursor: 'pointer', fontSize: 13,
  },
  empty: { color: '#5F5E5A', fontSize: 13, padding: 16, textAlign: 'center' },
}

export default function NodePanel({ node, onExpand, onClose }) {
  if (!node) return (
    <div style={s.panel}>
      <div style={s.empty}>Click a node to inspect it</div>
    </div>
  )

  const c = NODE_COLORS[node.label] || DEFAULT_NODE_COLOR
  const props = node.properties || {}

  return (
    <div style={s.panel}>
      <div style={s.header}>
        <span style={s.title}>Node inspector</span>
        <button style={s.closeBtn} onClick={onClose}>×</button>
      </div>
      <div style={s.body}>
        <span style={{ ...s.badge, background: c.bg, color: c.text }}>
          {node.label}
        </span>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 16 }}>
          {node.displayLabel}
        </div>
        {Object.entries(props).map(([k, v]) => {
          if (v === null || v === undefined || v === '') return null
          return (
            <div key={k} style={s.row}>
              <div style={s.key}>{k}</div>
              <div style={s.val}>{String(v)}</div>
            </div>
          )
        })}
        <button style={s.expandBtn} onClick={() => onExpand(node.id)}>
          Expand neighbors
        </button>
      </div>
    </div>
  )
}
