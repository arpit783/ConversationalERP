import React, { useState } from 'react'

// When embedded=true the outer wrapper/header/drag-handle are suppressed
// — the parent GraphExplorer panel owns those chrome elements.
export default function ResultsTable({ rows, height, onDragStart, onClose, embedded = false }) {
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [filter, setFilter] = useState('')

  if (!rows || rows.length === 0) return null

  const cols = Object.keys(rows[0])

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const filtered = filter
    ? rows.filter(row =>
        Object.values(row).some(v => String(v ?? '').toLowerCase().includes(filter.toLowerCase()))
      )
    : rows

  const sorted = sortCol
    ? [...filtered].sort((a, b) => {
        const av = a[sortCol], bv = b[sortCol]
        if (av === null) return 1
        if (bv === null) return -1
        const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
        return sortDir === 'asc' ? cmp : -cmp
      })
    : filtered

  function renderCell(val) {
    if (val === null || val === undefined)
      return <span style={{ color: '#d1d5db', fontStyle: 'italic' }}>—</span>
    if (val === true)
      return <span style={{ color: '#16a34a', fontWeight: 600 }}>true</span>
    if (val === false)
      return <span style={{ color: '#dc2626', fontWeight: 600 }}>false</span>
    const s = String(val)
    if (s.length > 48) return <span title={s}>{s.slice(0, 46)}…</span>
    return s
  }

  // ── Embedded mode: just the filter bar + scrollable table ─────────────────
  if (embedded) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: height || '100%', overflow: 'hidden' }}>
        {/* Filter bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 16px', borderBottom: '1px solid #f3f4f6',
          background: '#fff', flexShrink: 0,
        }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="5" cy="5" r="3.5" stroke="#9ca3af" strokeWidth="1.2"/>
            <line x1="7.5" y1="7.5" x2="10.5" y2="10.5" stroke="#9ca3af" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter rows…"
            style={{
              flex: 1, fontSize: 12, padding: '4px 8px',
              border: '1px solid #e5e7eb', borderRadius: 6,
              outline: 'none', color: '#374151', background: '#f9fafb',
            }}
          />
          {filter && (
            <span style={{ fontSize: 11, color: '#9ca3af' }}>
              {sorted.length} / {rows.length}
            </span>
          )}
        </div>

        {/* Scrollable table */}
        <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
          <table style={{
            width: '100%', borderCollapse: 'collapse', fontSize: 12,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}>
            <thead>
              <tr>
                {cols.map(c => (
                  <th
                    key={c}
                    onClick={() => handleSort(c)}
                    style={{
                      padding: '7px 14px', textAlign: 'left', fontWeight: 700,
                      fontSize: 11, color: '#374151', letterSpacing: '0.04em',
                      borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap',
                      position: 'sticky', top: 0, background: '#fff',
                      cursor: 'pointer', userSelect: 'none',
                      textTransform: 'uppercase',
                    }}
                  >
                    {c}
                    {sortCol === c
                      ? <span style={{ marginLeft: 4, color: '#6366f1' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
                      : <span style={{ marginLeft: 4, color: '#d1d5db' }}>↕</span>
                    }
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => (
                <tr
                  key={i}
                  style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f0f9ff' }}
                  onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fafafa' }}
                >
                  {cols.map(c => (
                    <td
                      key={c}
                      title={String(row[c] ?? '')}
                      style={{
                        padding: '7px 14px', color: '#374151',
                        borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap',
                        maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis',
                      }}
                    >
                      {renderCell(row[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {sorted.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af', fontSize: 12 }}>
              No rows match the filter
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Standalone mode (legacy, kept for backward compat) ────────────────────
  return (
    <div style={{
      borderTop: '1px solid #e5e7eb', background: '#fff',
      flexShrink: 0, display: 'flex', flexDirection: 'column',
      height, minHeight: 100, maxHeight: 500,
      boxShadow: '0 -2px 10px rgba(0,0,0,0.05)',
    }}>
      <div
        onMouseDown={onDragStart}
        style={{
          height: 6, cursor: 'ns-resize', background: 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}
      >
        <div style={{ width: 40, height: 3, borderRadius: 2, background: '#d1d5db' }} />
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 16px', borderBottom: '1px solid #f3f4f6', flexShrink: 0, gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>Query Results</span>
          <span style={{ fontSize: 11, background: '#f3f4f6', color: '#6b7280', borderRadius: 10, padding: '1px 8px' }}>
            {sorted.length}/{rows.length} rows
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter…"
            style={{
              fontSize: 11, padding: '4px 10px', border: '1px solid #e5e7eb',
              borderRadius: 6, outline: 'none', color: '#374151', width: 140, background: '#f9fafb',
            }}
          />
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16 }}>×</button>
        </div>
      </div>
      <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {cols.map(c => (
                <th key={c} onClick={() => handleSort(c)} style={{
                  padding: '7px 14px', textAlign: 'left', fontWeight: 600,
                  fontSize: 11, color: '#374151', borderBottom: '2px solid #e5e7eb',
                  whiteSpace: 'nowrap', position: 'sticky', top: 0, background: '#fff',
                  cursor: 'pointer', userSelect: 'none', textTransform: 'uppercase',
                }}>
                  {c}
                  {sortCol === c
                    ? <span style={{ marginLeft: 4, color: '#6366f1' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
                    : <span style={{ marginLeft: 4, color: '#d1d5db' }}>↕</span>
                  }
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f0f9ff' }}
                onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fafafa' }}>
                {cols.map(c => (
                  <td key={c} title={String(row[c] ?? '')} style={{
                    padding: '7px 14px', color: '#374151',
                    borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap',
                    maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {renderCell(row[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af', fontSize: 13 }}>
            No rows match the filter
          </div>
        )}
      </div>
    </div>
  )
}
