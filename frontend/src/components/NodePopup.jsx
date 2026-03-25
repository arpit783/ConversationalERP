import React, { useRef, useState, useEffect } from 'react'
import { NODE_COLORS, DEFAULT_NODE_COLOR } from '../constants'

const POPUP_W = 320
const POPUP_H = 440

// Entity type → icon letter mapping
const ENTITY_ICONS = {
  SalesOrder: 'SO', SalesOrderItem: 'SI', ScheduleLine: 'SL',
  BillingDocument: 'BD', BillingItem: 'BI', OutboundDelivery: 'OD',
  DeliveryItem: 'DI', BusinessPartner: 'BP', Product: 'PR',
  Plant: 'PL', JournalEntry: 'JE', Payment: 'PA',
}

function EntityBadge({ label, color }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: color.bg, border: `1px solid ${color.border}`,
      borderRadius: 6, padding: '2px 8px',
    }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: color.text, letterSpacing: '0.03em' }}>
        {ENTITY_ICONS[label] || label.slice(0, 2).toUpperCase()}
      </span>
      <span style={{ fontSize: 10, color: color.text, fontWeight: 500 }}>{label}</span>
    </div>
  )
}

export default function NodePopup({ node, pos, onExpand, onClose }) {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [expanding, setExpanding] = useState(false)
  const dragStart = useRef(null)
  const ref = useRef(null)

  useEffect(() => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    let x = (pos?.x || 200) + 20
    let y = (pos?.y || 200) - 60
    if (x + POPUP_W > vw - 20) x = (pos?.x || 200) - POPUP_W - 20
    if (y + POPUP_H > vh - 20) y = vh - POPUP_H - 20
    if (y < 60) y = 60
    setPosition({ x: Math.max(10, x), y })
  }, [pos])

  function onMouseDown(e) {
    if (e.target.closest('button') || e.target.tagName === 'BUTTON') return
    setDragging(true)
    dragStart.current = { mx: e.clientX, my: e.clientY, px: position.x, py: position.y }
    e.preventDefault()
  }

  useEffect(() => {
    if (!dragging) return
    function onMove(e) {
      const dx = e.clientX - dragStart.current.mx
      const dy = e.clientY - dragStart.current.my
      setPosition({ x: dragStart.current.px + dx, y: dragStart.current.py + dy })
    }
    function onUp() { setDragging(false) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [dragging])

  if (!node) return null
  const c = NODE_COLORS[node.label] || DEFAULT_NODE_COLOR
  const props = node.properties || {}

  // Filter and sort: key props first, then rest, hide internal ones
  const SKIP = new Set(['label', 'displayLabel', 'bg', 'border', 'textColor'])
  const KEY_PROPS = ['Entity', 'CompanyCode', 'FiscalYear', 'AccountingDocument', 'GlAccount',
    'ReferenceDocument', 'CostCenter', 'ProfitCenter', 'TransactionCurrency',
    'AmountInTransactionCurrency', 'CompanyCodeCurrency', 'AmountInCompanyCodeCurrency',
    'PostingDate', 'DocumentDate', 'AccountingDocumentType', 'AccountingDocumentItem']

  const entries = Object.entries(props)
    .filter(([k, v]) => !SKIP.has(k) && v !== null && v !== undefined && v !== '')
  const visible = entries.slice(0, 14)
  const hidden = entries.length - visible.length
  const connections = node.connectionCount || visible.length

  return (
    <div
      ref={ref}
      onMouseDown={onMouseDown}
      style={{
        position: 'fixed', left: position.x, top: position.y,
        width: POPUP_W, zIndex: 50,
        background: '#fff', borderRadius: 14,
        border: '1px solid #e5e7eb',
        boxShadow: '0 12px 40px rgba(0,0,0,0.14)',
        cursor: dragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        display: 'flex', flexDirection: 'column',
        maxHeight: POPUP_H,
        overflow: 'hidden',
      }}
    >
      {/* Colored top accent bar */}
      <div style={{ height: 4, background: c.border, borderRadius: '14px 14px 0 0', flexShrink: 0 }} />

      {/* Header */}
      <div style={{
        padding: '12px 14px 10px',
        borderBottom: '1px solid #f3f4f6',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        flexShrink: 0,
        background: '#fafafa',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', lineHeight: 1.15 }}>
            {node.label}
          </div>
          <EntityBadge label={node.label} color={c} />
          <div style={{ fontSize: 11, color: '#9ca3af', wordBreak: 'break-all', maxWidth: 230 }}>
            {node.displayLabel}
          </div>
        </div>
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={onClose}
          style={{
            background: '#f3f4f6', border: 'none', cursor: 'pointer',
            width: 24, height: 24, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, color: '#6b7280', lineHeight: 1, flexShrink: 0,
          }}
        >×</button>
      </div>

      {/* Properties list — SAP field style */}
      <div style={{ overflowY: 'auto', flex: 1, padding: '8px 0' }}>
        {visible.map(([k, v]) => (
          <div key={k} style={{
            display: 'grid', gridTemplateColumns: '140px 1fr',
            padding: '4px 14px', gap: 8, alignItems: 'start',
            borderBottom: '1px solid #f9fafb',
          }}>
            <span style={{
              fontSize: 12, fontWeight: 600, color: '#374151',
              wordBreak: 'break-word', lineHeight: 1.4,
            }}>
              {k}:
            </span>
            <span style={{
              fontSize: 12, color: '#6b7280', wordBreak: 'break-all', lineHeight: 1.4,
            }}>
              {String(v)}
            </span>
          </div>
        ))}
        {hidden > 0 && (
          <div style={{ padding: '6px 14px', fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>
            {hidden} additional fields hidden for readability
          </div>
        )}
        {/* Connections count — like Dodge AI */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 14px 4px', borderTop: '1px solid #f3f4f6', marginTop: 4,
        }}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <circle cx="2" cy="7" r="1.5" fill="#9ca3af"/>
            <circle cx="12" cy="3" r="1.5" fill="#9ca3af"/>
            <circle cx="12" cy="11" r="1.5" fill="#9ca3af"/>
            <line x1="3.5" y1="7" x2="10.5" y2="3" stroke="#d1d5db" strokeWidth="1.2"/>
            <line x1="3.5" y1="7" x2="10.5" y2="11" stroke="#d1d5db" strokeWidth="1.2"/>
          </svg>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Connections:</span>
          <span style={{ fontSize: 12, color: '#6b7280' }}>{connections}</span>
        </div>
      </div>

      {/* Footer actions */}
      <div style={{
        padding: '10px 14px', borderTop: '1px solid #f3f4f6', flexShrink: 0,
        display: 'flex', gap: 8, background: '#fafafa',
      }}>
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={async () => {
            setExpanding(true)
            try { await onExpand(node.id) }
            finally { setExpanding(false) }
          }}
          disabled={expanding}
          style={{
            flex: 1, padding: '8px 0',
            background: expanding ? '#f3f4f6' : c.bg,
            border: `1.5px solid ${expanding ? '#e5e7eb' : c.border}`,
            borderRadius: 8,
            color: expanding ? '#9ca3af' : c.text,
            cursor: expanding ? 'not-allowed' : 'pointer',
            fontSize: 12, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { if (!expanding) e.currentTarget.style.opacity = '0.85' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
        >
          {expanding ? (
            <>
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                border: '2px solid #d1d5db', borderTopColor: '#6b7280',
                animation: 'spin 0.7s linear infinite',
              }} />
              Expanding…
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="2" fill="currentColor"/>
                <circle cx="1.5" cy="1.5" r="1.5" fill="currentColor" opacity="0.5"/>
                <circle cx="10.5" cy="1.5" r="1.5" fill="currentColor" opacity="0.5"/>
                <circle cx="1.5" cy="10.5" r="1.5" fill="currentColor" opacity="0.5"/>
                <circle cx="10.5" cy="10.5" r="1.5" fill="currentColor" opacity="0.5"/>
                <line x1="6" y1="6" x2="1.5" y2="1.5" stroke="currentColor" strokeWidth="0.8" opacity="0.4"/>
                <line x1="6" y1="6" x2="10.5" y2="1.5" stroke="currentColor" strokeWidth="0.8" opacity="0.4"/>
                <line x1="6" y1="6" x2="1.5" y2="10.5" stroke="currentColor" strokeWidth="0.8" opacity="0.4"/>
                <line x1="6" y1="6" x2="10.5" y2="10.5" stroke="currentColor" strokeWidth="0.8" opacity="0.4"/>
              </svg>
              Expand neighbours
            </>
          )}
        </button>
      </div>
    </div>
  )
}
