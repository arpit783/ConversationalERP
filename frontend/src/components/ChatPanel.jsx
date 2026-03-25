import React, { useState, useRef, useEffect } from 'react'
import { streamChat, clearSession } from '../api'
import { EXAMPLE_QUERIES } from '../constants'

const SESSION_ID = `session-${Date.now()}`

const s = {
  panel: { display:'flex', flexDirection:'column', height:'100%', background:'#fff' },

  // Header — "Chat with Graph" title bar
  header: {
    padding:'14px 18px 12px', borderBottom:'1px solid #f3f4f6', flexShrink:0,
    background:'linear-gradient(180deg,#fafbff 0%,#fff 100%)',
  },
  headerTop: {
    display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10,
  },
  headerTitle: { fontSize:15, fontWeight:800, color:'#111827', letterSpacing:'-0.01em' },
  headerSub: { fontSize:12, color:'#9ca3af' },
  clearBtn: {
    background:'none', border:'1px solid #e5e7eb', borderRadius:6,
    padding:'3px 10px', color:'#6b7280', cursor:'pointer', fontSize:11,
  },

  // Agent identity row
  agentRow: { display:'flex', alignItems:'center', gap:10, padding:'12px 18px 0' },
  agentAvatar: {
    width:38, height:38, borderRadius:'50%',
    background:'linear-gradient(135deg,#1a1a2e 0%,#16213e 60%,#0f3460 100%)',
    display:'flex', alignItems:'center', justifyContent:'center',
    fontSize:14, fontWeight:700, color:'#fff', flexShrink:0,
    boxShadow:'0 2px 8px rgba(0,0,0,0.18)',
  },
  agentName: { fontSize:13, fontWeight:700, color:'#111827' },
  agentRole: { fontSize:11, color:'#9ca3af' },

  // Messages
  messages: {
    flex:1, overflowY:'auto', padding:'16px 18px',
    display:'flex', flexDirection:'column', gap:14,
  },

  // User bubble
  userBubble: {
    alignSelf:'flex-end', maxWidth:'80%',
    background:'#111827', color:'#fff',
    padding:'10px 14px', borderRadius:'12px 12px 3px 12px',
    fontSize:13, lineHeight:1.55,
  },

  // Agent bubble
  agentBubble: {
    alignSelf:'flex-start', maxWidth:'90%',
    background:'#f9fafb', color:'#111827',
    padding:'10px 14px', borderRadius:'12px 12px 12px 3px',
    fontSize:13, lineHeight:1.55, border:'1px solid #f3f4f6',
    whiteSpace:'pre-wrap',
  },

  // Status chip
  statusChip: {
    alignSelf:'flex-start', display:'flex', alignItems:'center', gap:6,
    background:'#eff6ff', border:'1px solid #bfdbfe',
    borderRadius:20, padding:'4px 10px', fontSize:11, color:'#3b82f6',
  },
  spinner: {
    width:10, height:10, borderRadius:'50%',
    border:'2px solid #bfdbfe', borderTopColor:'#3b82f6',
    animation:'spin 0.7s linear infinite',
  },

  // Cypher block
  codeBlock: {
    alignSelf:'flex-start', width:'100%',
    background:'#f8fafc', border:'1px solid #e2e8f0',
    borderRadius:8, padding:'10px 12px', overflowX:'auto',
    fontSize:11, fontFamily:'monospace', color:'#475569',
    whiteSpace:'pre-wrap', wordBreak:'break-all', lineHeight:1.5,
  },

  // Result chip
  resultChip: {
    alignSelf:'flex-start', display:'flex', alignItems:'center', gap:6,
    background:'#f0fdf4', border:'1px solid #bbf7d0',
    borderRadius:20, padding:'4px 10px', fontSize:11, color:'#16a34a',
  },

  // Error bubble
  errorBubble: {
    alignSelf:'flex-start', maxWidth:'90%',
    background:'#fff5f5', color:'#b91c1c',
    padding:'10px 14px', borderRadius:10, fontSize:12,
    border:'1px solid #fecaca', whiteSpace:'pre-wrap',
  },

  // Examples
  examples: { padding:'0 18px 10px', flexShrink:0 },
  exLabel: { fontSize:10, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 },
  exBtn: {
    display:'block', width:'100%', textAlign:'left', padding:'6px 10px',
    background:'#f9fafb', border:'1px solid #f3f4f6',
    borderRadius:7, color:'#374151', cursor:'pointer', fontSize:12,
    marginBottom:5, lineHeight:1.4,
  },

  // Status bar
  statusBar: {
    padding:'8px 18px', borderTop:'1px solid #f3f4f6', flexShrink:0,
    display:'flex', alignItems:'center', gap:6, fontSize:11, color:'#9ca3af',
  },
  statusDot: (active) => ({
    width:7, height:7, borderRadius:'50%',
    background: active ? '#22c55e' : '#d1d5db', flexShrink:0,
  }),

  // Input row
  inputRow: {
    display:'flex', gap:8, padding:'10px 18px 14px',
    borderTop:'1px solid #f3f4f6', flexShrink:0, alignItems:'flex-end',
  },
  input: {
    flex:1, background:'#f9fafb', border:'1px solid #e5e7eb',
    borderRadius:10, padding:'9px 13px', color:'#111827',
    fontSize:13, outline:'none', resize:'none', lineHeight:1.5,
    fontFamily:'inherit',
  },
  sendBtn: {
    padding:'9px 18px', background:'#111827', border:'none',
    borderRadius:10, color:'#fff', cursor:'pointer', fontSize:13,
    fontWeight:600, flexShrink:0,
  },
  sendBtnDisabled: {
    padding:'9px 18px', background:'#f3f4f6', border:'none',
    borderRadius:10, color:'#9ca3af', fontSize:13, fontWeight:600, flexShrink:0,
  },
}

// Inject keyframe for spinner
if (typeof document !== 'undefined' && !document.getElementById('erp-spin')) {
  const st = document.createElement('style')
  st.id = 'erp-spin'
  st.textContent = '@keyframes spin { to { transform: rotate(360deg) } }'
  document.head.appendChild(st)
}

export default function ChatPanel({ onGraphData, onHighlight }) {
  const [messages, setMessages] = useState([{
    role:'assistant', type:'text',
    content:'Hi! I can help you analyze the Order to Cash process.\n\nAsk me about sales orders, deliveries, billing documents, customers, or trace the full flow of any document.',
  }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showExamples, setShowExamples] = useState(true)
  const abortRef = useRef(null)
  const bottomRef = useRef(null)
  const history = useRef([])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages])

  function addMsg(msg) { setMessages(prev => [...prev, msg]) }

  function updateLast(patch) {
    setMessages(prev => {
      const copy = [...prev]
      const idx = copy.map(m => m.role).lastIndexOf('assistant')
      if (idx !== -1) copy[idx] = { ...copy[idx], ...patch }
      return copy
    })
  }

  function appendText(chunk) {
    setMessages(prev => {
      const copy = [...prev]
      const idx = copy.map(m => m.role).lastIndexOf('assistant')
      if (idx !== -1 && copy[idx].type === 'streaming')
        copy[idx] = { ...copy[idx], content: copy[idx].content + chunk }
      return copy
    })
  }

  function send(text) {
    if (!text.trim() || loading) return
    setShowExamples(false); setLoading(true)
    addMsg({ role:'user', type:'text', content: text })
    setInput('')
    addMsg({ role:'assistant', type:'streaming', content:'' })

    let cypher = ''
    let gotResult = false

    abortRef.current = streamChat(text, history.current.slice(-10), (event, data) => {
      if (event === 'status') {
        // Replace the current streaming/status message with a status chip
        updateLast({ type:'status', status: data.message, cypher: data.cypher })
        cypher = data.cypher || cypher

      } else if (event === 'graph_data') {
        gotResult = true
        onGraphData && onGraphData(data)

        // Replace the status chip with the result chip, then add a fresh streaming msg for narrative
        updateLast({
          type: 'result_chip',
          content: `${data.nodes?.length || 0} nodes · ${data.edges?.length || 0} edges · ${data.count} records`,
          cypher,
        })
        addMsg({ role:'assistant', type:'streaming', content:'' })

      } else if (event === 'text') {
        appendText(data)

      } else if (event === 'error') {
        updateLast({ type:'error', content: String(data) })
        setLoading(false)

      } else if (event === 'done') {
        // Convert the last streaming bubble to plain text (narrative is complete)
        setMessages(prev => {
          const copy = [...prev]
          const idx = copy.map(m => m.role).lastIndexOf('assistant')
          if (idx !== -1 && copy[idx].type === 'streaming') {
            // If narrative was empty (no text chunks), remove the empty bubble entirely
            if (!copy[idx].content || copy[idx].content.trim() === '') {
              copy.splice(idx, 1)
            } else {
              copy[idx] = { ...copy[idx], type:'text' }
            }
          }
          return copy
        })
        history.current.push(
          { role:'user', content: text },
          { role:'assistant', content: gotResult ? '(result)' : '(no result)' }
        )
        setLoading(false)
      }
    }, SESSION_ID)
  }

  async function handleClear() {
    abortRef.current?.abort()
    await clearSession(SESSION_ID)
    history.current = []
    setMessages([{ role:'assistant', type:'text',
      content:'Conversation cleared. Ask me anything about the O2C data.' }])
    setShowExamples(true); setLoading(false)
  }

  return (
    <div style={s.panel}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerTop}>
          <div>
            <div style={s.headerTitle}>Chat with Graph</div>
            <div style={s.headerSub}>Order to Cash</div>
          </div>
          <button style={s.clearBtn} onClick={handleClear}>Clear</button>
        </div>
        <div style={s.agentRow}>
          <div style={s.agentAvatar}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="8" stroke="white" strokeWidth="1.5" strokeOpacity="0.6"/>
              <path d="M6 10h8M10 6v8" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
              <circle cx="10" cy="10" r="2" fill="white"/>
            </svg>
          </div>
          <div>
            <div style={s.agentName}>Graph Agent</div>
            <div style={s.agentRole}>Order to Cash · AI powered</div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={s.messages}>
        {messages.map((m, i) => {
          if (m.type === 'status') return (
            <div key={i} style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <div style={s.statusChip}>
                <div style={s.spinner} />
                {m.status}
              </div>
              {m.cypher && (
                <div style={s.codeBlock}>{m.cypher}</div>
              )}
            </div>
          )
          if (m.type === 'result_chip') return (
            <div key={i} style={s.resultChip}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="5" stroke="#16a34a" strokeWidth="1.2"/>
                <path d="M3.5 6l2 2 3-3" stroke="#16a34a" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              {m.content}
            </div>
          )
          if (m.type === 'error') return <div key={i} style={s.errorBubble}>{m.content}</div>
          if (m.role === 'user') return <div key={i} style={s.userBubble}>{m.content}</div>
          return (
            <div key={i} style={s.agentBubble}>
              {m.content}
              {m.type === 'streaming' && <span style={{ opacity:0.4 }}> ▋</span>}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Examples */}
      {showExamples && (
        <div style={s.examples}>
          <div style={s.exLabel}>Try an example</div>
          {EXAMPLE_QUERIES.slice(0, 3).map((q, i) => (
            <button key={i} style={s.exBtn} onClick={() => send(q)}>{q}</button>
          ))}
        </div>
      )}

      {/* Status bar */}
      <div style={s.statusBar}>
        <div style={s.statusDot(!loading)} />
        {loading ? 'Agent is thinking…' : 'Graph Agent is awaiting instructions'}
      </div>

      {/* Input */}
      <div style={s.inputRow}>
        <textarea
          style={s.input} rows={2} value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
          placeholder="Analyze anything"
          disabled={loading}
        />
        <button
          style={loading ? s.sendBtnDisabled : s.sendBtn}
          onClick={() => send(input)} disabled={loading}
        >
          {loading ? '…' : 'Send'}
        </button>
      </div>
    </div>
  )
}
