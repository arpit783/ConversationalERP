import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react'
import { useGraph } from '../useGraph'
import { expandNode, searchNodes } from '../api'
import { NODE_COLORS } from '../constants'
import NodePopup from './NodePopup'
import ResultsTable from './ResultsTable'

const s = {
  container: { display: 'flex', flex: 1, overflow: 'hidden', flexDirection: 'column', position: 'relative' },
  canvas: { flex: 1, background: '#f5f6f8' },

  toolbar: {
    position: 'absolute', top: 14, left: 14, display: 'flex', gap: 7, zIndex: 20,
    alignItems: 'center',
  },
  overlayBtn: {
    display: 'flex', alignItems: 'center', gap: 5,
    background: 'rgba(255,255,255,0.95)', border: '1px solid #e5e7eb',
    borderRadius: 8, padding: '6px 11px', cursor: 'pointer',
    fontSize: 11, fontWeight: 600, color: '#374151',
    boxShadow: '0 1px 6px rgba(0,0,0,0.08)',
    backdropFilter: 'blur(8px)',
    transition: 'all 0.15s',
  },
  overlayBtnActive: {
    display: 'flex', alignItems: 'center', gap: 5,
    background: '#1a1a1a', border: '1px solid #1a1a1a',
    borderRadius: 8, padding: '6px 11px', cursor: 'pointer',
    fontSize: 11, fontWeight: 600, color: '#fff',
    boxShadow: '0 1px 6px rgba(0,0,0,0.15)',
    backdropFilter: 'blur(8px)',
  },
  countBadge: {
    background: 'rgba(255,255,255,0.95)', border: '1px solid #e5e7eb',
    borderRadius: 8, padding: '5px 11px',
    fontSize: 11, fontWeight: 600, color: '#6b7280',
    boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
  },
  searchWrap: {
    position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)',
    zIndex: 20, width: 300,
  },
  searchInput: {
    width: '100%', background: 'rgba(255,255,255,0.97)', border: '1px solid #e5e7eb',
    borderRadius: 10, padding: '8px 16px', fontSize: 13, outline: 'none',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)', color: '#111827',
    backdropFilter: 'blur(8px)', boxSizing: 'border-box',
  },
  searchDropdown: {
    position: 'absolute', top: 'calc(100% + 5px)', left: 0, right: 0,
    background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
    maxHeight: 240, overflowY: 'auto',
    boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
  },
  searchItem: {
    padding: '9px 14px', cursor: 'pointer', fontSize: 12,
    borderBottom: '1px solid #f3f4f6', color: '#374151',
    display: 'flex', alignItems: 'center', gap: 8,
  },
  legendBar: {
    position: 'absolute', bottom: 16, left: 16, zIndex: 20,
    display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 520,
  },
  legendItem: {
    display: 'flex', alignItems: 'center', gap: 5, fontSize: 11,
    background: 'rgba(255,255,255,0.92)', padding: '4px 9px',
    borderRadius: 12, border: '1px solid #e5e7eb', color: '#4b5563',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)', backdropFilter: 'blur(6px)',
    cursor: 'default',
  },
  emptyState: {
    position: 'absolute', top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    textAlign: 'center', pointerEvents: 'none', zIndex: 5,
  },
}

const LEGEND_ITEMS = [
  ['SalesOrder', 'Sales Order'], ['SalesOrderItem', 'SO Item'],
  ['BillingDocument', 'Billing Doc'], ['OutboundDelivery', 'Delivery'],
  ['BusinessPartner', 'Customer'], ['Product', 'Product'],
  ['Plant', 'Plant'], ['JournalEntry', 'Journal'], ['Payment', 'Payment'],
]

const GraphExplorer = forwardRef(function GraphExplorer({ initialNodes, initialEdges }, ref) {
  const canvasRef = useRef(null)
  const [selectedNode, setSelectedNode] = useState(null)
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0 })
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [tableRows, setTableRows] = useState(null)
  const [showEdgeLabels, setShowEdgeLabels] = useState(false)
  const [viewMode, setViewModeState] = useState('dot')
  const [nodeCount, setNodeCount] = useState(0)
  const [edgeCount, setEdgeCount] = useState(0)
  const [tableHeight, setTableHeight] = useState(220)

  const { addElements, setElements, highlight, highlightChatResults, highlightExpanded, fit, resetHighlight, setEdgeLabels, setViewMode } = useGraph(
    canvasRef,
    (node, pos) => { setSelectedNode(node); if (pos) setPopupPos(pos) },
    (nc, ec) => { setNodeCount(nc); setEdgeCount(ec) }
  )

  useImperativeHandle(ref, () => ({
    // Called by App when chat returns graph_data event
    addGraphData: (nodes, edges, table) => {
      const added = addElements(nodes, edges)

      // Highlight ALL returned nodes (new + already present) and their edges
      const allIds = nodes.map(n => n.id)
      if (allIds.length > 0) {
        highlightChatResults(allIds, edges)
      }

      // Show table if we have rows
      if (table && table.length > 0) {
        setTableRows(table)
      }
    },
    highlightNodes: (ids) => highlight(ids),
    setQueryResults: (rows) => setTableRows(rows && rows.length > 0 ? rows : null),
    fit,
  }))

  useEffect(() => {
    if (initialNodes && initialNodes.length) setElements(initialNodes, initialEdges || [])
  }, [initialNodes]) // eslint-disable-line

  // ── expand neighbours from NodePopup ──────────────────────────────────────
  const [expandToast, setExpandToast] = useState(null)   // { msg, type }
  const expandToastTimer = useRef(null)

  function showExpandToast(msg, type = 'info') {
    clearTimeout(expandToastTimer.current)
    setExpandToast({ msg, type })
    expandToastTimer.current = setTimeout(() => setExpandToast(null), 3500)
  }

  async function handleExpand(nodeId) {
    try {
      showExpandToast('Fetching neighbours…', 'loading')
      const d = await expandNode(nodeId)
      const newNodes = d.nodes || []
      const newEdges = d.edges || []

      const added = addElements(newNodes, newEdges)

      // totalNeighbourCount = what the DB returned (including already-on-canvas nodes)
      // Only show "no neighbours" if the DB itself returned nothing
      if (added.totalNeighbourCount === 0) {
        showExpandToast('No neighbours found for this node', 'empty')
        return
      }

      // Some/all neighbours already on canvas — still highlight the existing connections
      highlightExpanded(nodeId, added.newNodeIds.length > 0
        ? added.newNodeIds
        : newNodes.map(n => n.id)  // all neighbours already present — highlight them anyway
      )

      if (added.newNodeCount === 0 && added.newEdgeCount === 0) {
        showExpandToast('All neighbours already shown', 'info')
      } else {
        showExpandToast(
          `+${added.newNodeCount} node${added.newNodeCount !== 1 ? 's' : ''}, ` +
          `+${added.newEdgeCount} edge${added.newEdgeCount !== 1 ? 's' : ''}`,
          'success'
        )
      }
    } catch (e) {
      console.error(e)
      showExpandToast('Failed to fetch neighbours', 'error')
    }
  }

  async function handleSearch(q) {
    setSearchQ(q)
    if (!q.trim()) { setSearchResults([]); return }
    try {
      const d = await searchNodes(q)
      setSearchResults(d.nodes || [])
    } catch (e) {
      console.error(e)
    }
  }

  function pickResult(node) {
    setSearchQ('')
    setSearchResults([])
    setSelectedNode(node)
    addElements([node], [])
    handleExpand(node.id)
  }

  function toggleViewMode() {
    const next = viewMode === 'dot' ? 'detail' : 'dot'
    setViewModeState(next)
    setViewMode(next)
  }

  function startDrag(e) {
    const startY = e.clientY
    const startH = tableHeight
    function onMove(ev) {
      const delta = startY - ev.clientY
      setTableHeight(Math.max(100, Math.min(480, startH + delta)))
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const isEmpty = nodeCount === 0 && !(initialNodes && initialNodes.length)

  return (
    <div style={s.container}>

      {/* Toolbar — top left */}
      <div style={s.toolbar}>
        <button style={s.overlayBtn} onClick={fit} title="Fit graph to view">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Minimize
        </button>

        <button
          style={viewMode === 'dot' ? s.overlayBtnActive : s.overlayBtn}
          onClick={toggleViewMode}
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <circle cx="3" cy="3" r="1.5" fill="currentColor"/>
            <circle cx="11" cy="3" r="1.5" fill="currentColor"/>
            <circle cx="3" cy="11" r="1.5" fill="currentColor"/>
            <circle cx="11" cy="11" r="1.5" fill="currentColor"/>
            <circle cx="7" cy="7" r="1.5" fill="currentColor"/>
          </svg>
          {viewMode === 'dot' ? 'Hide Granular Overlay' : 'Show Granular Overlay'}
        </button>

        {viewMode === 'detail' && (
          <button
            style={showEdgeLabels ? s.overlayBtnActive : s.overlayBtn}
            onClick={() => {
              const next = !showEdgeLabels
              setShowEdgeLabels(next)
              setEdgeLabels(next)
            }}
          >
            Edge labels
          </button>
        )}

        {selectedNode && (
          <button
            style={s.overlayBtn}
            onClick={() => { resetHighlight(); setSelectedNode(null) }}
          >
            ✕ Clear
          </button>
        )}

        {nodeCount > 0 && (
          <div style={s.countBadge}>
            {nodeCount} nodes · {edgeCount} edges
          </div>
        )}
      </div>

      {/* Search — top center */}
      <div style={s.searchWrap}>
        <input
          style={s.searchInput}
          placeholder="🔍  Search by ID, name, or document number…"
          value={searchQ}
          onChange={e => handleSearch(e.target.value)}
        />
        {searchResults.length > 0 && (
          <div style={s.searchDropdown}>
            {searchResults.map((n, i) => {
              const c = NODE_COLORS[n.label] || { bg: '#888', border: '#666' }
              return (
                <div
                  key={i}
                  style={s.searchItem}
                  onClick={() => pickResult(n)}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f0f9ff' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '' }}
                >
                  <span style={{
                    display: 'inline-block', padding: '2px 8px', borderRadius: 12,
                    fontSize: 10, fontWeight: 700, background: c.bg,
                    border: '1px solid ' + c.border, color: '#fff', whiteSpace: 'nowrap',
                  }}>
                    {n.label}
                  </span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {n.displayLabel}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Graph canvas */}
      <div ref={canvasRef} style={s.canvas} />

      {/* View mode indicator — top right */}
      <div style={{
        position: 'absolute', top: 14, right: 16, zIndex: 20,
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'rgba(255,255,255,0.92)', border: '1px solid #e5e7eb',
        borderRadius: 8, padding: '5px 11px', fontSize: 11, fontWeight: 600,
        color: '#6b7280', boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{
          width: viewMode === 'dot' ? 6 : 10,
          height: viewMode === 'dot' ? 6 : 10,
          borderRadius: '50%',
          background: viewMode === 'dot' ? '#93c5fd' : '#6ee7b7',
          border: viewMode === 'dot' ? '1px solid #3b82f6' : '1px solid #059669',
          transition: 'all 0.2s',
        }} />
        {viewMode === 'dot' ? 'Cluster view' : 'Detail view'}
      </div>

      {/* Empty state */}
      {isEmpty && (
        <div style={s.emptyState}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🕸️</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
            No graph data yet
          </div>
          <div style={{ fontSize: 13, color: '#9ca3af' }}>
            Click <strong>Load data</strong> in the top bar to ingest SAP O2C records
          </div>
        </div>
      )}

      {/* Node popup */}
      {selectedNode && (
        <NodePopup
          node={selectedNode}
          pos={popupPos}
          onExpand={handleExpand}
          onClose={() => setSelectedNode(null)}
        />
      )}

      {/* Legend — bottom left */}
      <div style={s.legendBar}>
        {LEGEND_ITEMS.map(([key, label]) => {
          const c = NODE_COLORS[key] || { bg: '#e5e7eb', border: '#d1d5db' }
          const dotSize = viewMode === 'dot' ? 7 : 10
          const dotBorder = viewMode === 'dot' ? '1px' : '1.5px'
          return (
            <div key={key} style={s.legendItem}>
              <div style={{
                width: dotSize, height: dotSize, borderRadius: '50%',
                background: c.bg, border: dotBorder + ' solid ' + c.border,
                flexShrink: 0, transition: 'all 0.2s',
              }} />
              {label}
            </div>
          )
        })}
      </div>

      {/* ── Query Results Panel ── */}
      {tableRows && tableRows.length > 0 && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          zIndex: 25, display: 'flex', flexDirection: 'column',
          background: '#fff',
          borderTop: '2px solid #e5e7eb',
          boxShadow: '0 -4px 16px rgba(0,0,0,0.08)',
          height: tableHeight,
          minHeight: 120, maxHeight: 500,
        }}>
          {/* Drag handle */}
          <div
            onMouseDown={startDrag}
            style={{
              height: 8, cursor: 'ns-resize', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#fafafa', borderBottom: '1px solid #f3f4f6',
            }}
          >
            <div style={{ width: 36, height: 3, borderRadius: 2, background: '#d1d5db' }} />
          </div>

          {/* Panel header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 16px', borderBottom: '1px solid #f3f4f6',
            background: '#fafafa', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Table icon */}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="1" width="12" height="12" rx="2" stroke="#6366f1" strokeWidth="1.2"/>
                <line x1="1" y1="5" x2="13" y2="5" stroke="#6366f1" strokeWidth="1.2"/>
                <line x1="5" y1="5" x2="5" y2="13" stroke="#6366f1" strokeWidth="1.2"/>
              </svg>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                Query Results
              </span>
              <span style={{
                fontSize: 11, background: '#eef2ff', color: '#6366f1',
                borderRadius: 10, padding: '1px 9px', fontWeight: 600,
                border: '1px solid #c7d2fe',
              }}>
                {tableRows.length} rows · {Object.keys(tableRows[0] || {}).length} cols
              </span>
            </div>
            <button
              onClick={() => setTableRows(null)}
              style={{
                background: '#f3f4f6', border: 'none', cursor: 'pointer',
                width: 24, height: 24, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, color: '#6b7280',
              }}
            >×</button>
          </div>

          {/* Table content */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <ResultsTable
              rows={tableRows}
              height={tableHeight - 56}
              onDragStart={startDrag}
              onClose={() => setTableRows(null)}
              embedded
            />
          </div>
        </div>
      )}

      {/* ── Expand neighbours toast ── */}
      {expandToast && (
        <div style={{
          position: 'absolute', bottom: tableRows ? tableHeight + 16 : 16,
          left: '50%', transform: 'translateX(-50%)',
          zIndex: 60, pointerEvents: 'none',
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '9px 18px', borderRadius: 10,
          fontSize: 12, fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          transition: 'bottom 0.2s',
          ...(expandToast.type === 'success'
            ? { background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }
            : expandToast.type === 'empty' || expandToast.type === 'info'
            ? { background: '#fefce8', color: '#92400e', border: '1px solid #fde68a' }
            : expandToast.type === 'error'
            ? { background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }
            : { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }),
        }}>
          {expandToast.type === 'loading' && (
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              border: '2px solid #bfdbfe', borderTopColor: '#1d4ed8',
              animation: 'spin 0.7s linear infinite', flexShrink: 0,
            }} />
          )}
          {expandToast.type === 'success' && (
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle cx="6.5" cy="6.5" r="5.5" stroke="#15803d" strokeWidth="1.2"/>
              <path d="M3.5 6.5l2 2 4-4" stroke="#15803d" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          )}
          {expandToast.type === 'empty' && (
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle cx="6.5" cy="6.5" r="5.5" stroke="#92400e" strokeWidth="1.2"/>
              <line x1="6.5" y1="4" x2="6.5" y2="7.5" stroke="#92400e" strokeWidth="1.3" strokeLinecap="round"/>
              <circle cx="6.5" cy="9.5" r="0.8" fill="#92400e"/>
            </svg>
          )}
          {expandToast.msg}
        </div>
      )}

    </div>
  )
})

export default GraphExplorer
