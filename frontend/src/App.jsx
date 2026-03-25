import React, { useState, useEffect, useRef } from 'react'
import TopBar from './components/TopBar'
import GraphExplorer from './components/GraphExplorer'
import ChatPanel from './components/ChatPanel'
import { fetchOverview, fetchInitialGraph, triggerIngest } from './api'

const s = {
  app: { display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#f7f8fa' },
  body: { display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' },
  graphArea: { display: 'flex', flex: 1, flexDirection: 'column', overflow: 'hidden', position: 'relative' },
  chatArea: (open) => ({
    width: open ? 380 : 0,
    minWidth: open ? 380 : 0,
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    borderLeft: open ? '1px solid #e5e7eb' : 'none',
    background: '#fff',
    boxShadow: open ? '-2px 0 8px rgba(0,0,0,0.06)' : 'none',
    transition: 'width 0.25s ease, min-width 0.25s ease',
    // Keep mounted always — never unmount so chat history is preserved
    visibility: open ? 'visible' : 'hidden',
  }),
  toast: {
    position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
    background: '#1a1a1a', borderRadius: 8, padding: '10px 20px',
    fontSize: 13, color: '#fff', zIndex: 200,
    boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
  },
}

export default function App() {
  const [stats, setStats] = useState(null)
  const [initialNodes, setInitialNodes] = useState([])
  const [initialEdges, setInitialEdges] = useState([])
  const [toast, setToast] = useState(null)
  const [chatOpen, setChatOpen] = useState(true)
  const graphRef = useRef(null)

  useEffect(() => { loadOverview(); loadInitialGraph() }, [])

  async function loadOverview() {
    try { setStats(await fetchOverview()) }
    catch { showToast('Could not reach backend — is it running on port 8000?') }
  }

  async function loadInitialGraph() {
    try {
      const data = await fetchInitialGraph()
      setInitialNodes(data.nodes || [])
      setInitialEdges(data.edges || [])
    } catch {}
  }

  async function handleIngest() {
    showToast('Ingesting data…')
    try {
      await triggerIngest()
      showToast('Ingestion complete!')
      await loadOverview(); await loadInitialGraph()
    } catch (e) { showToast('Ingestion failed: ' + e.message) }
  }

  function showToast(msg, duration = 4000) {
    setToast(msg); setTimeout(() => setToast(null), duration)
  }

  function handleGraphData(data) {
    // addGraphData handles nodes, edges, table display, highlighting and viewport fit
    graphRef.current?.addGraphData(data.nodes || [], data.edges || [], data.table || [])
    loadOverview()
  }

  return (
    <div style={s.app}>
      <TopBar stats={stats} onIngest={handleIngest} chatOpen={chatOpen} onToggleChat={() => setChatOpen(o => !o)} />
      <div style={s.body}>
        <div style={s.graphArea}>
          <GraphExplorer ref={graphRef} initialNodes={initialNodes} initialEdges={initialEdges} />
        </div>
        {/* Always mounted — never unmounted — so chat history is preserved when hidden */}
        <div style={s.chatArea(chatOpen)}>
          <ChatPanel
            onGraphData={handleGraphData}
            onHighlight={ids => graphRef.current?.highlightNodes(ids)}
          />
        </div>
      </div>
      {toast && <div style={s.toast}>{toast}</div>}
    </div>
  )
}
