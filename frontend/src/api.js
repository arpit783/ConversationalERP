const BASE = ''  // proxied via vite

export async function fetchOverview() {
  const r = await fetch(`${BASE}/graph/overview`)
  return r.json()
}

export async function fetchInitialGraph() {
  const r = await fetch(`${BASE}/graph/initial`)
  return r.json()
}

export async function expandNode(nodeId) {
  const r = await fetch(`${BASE}/graph/expand`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ node_id: nodeId }),
  })
  return r.json()
}

export async function searchNodes(query) {
  const r = await fetch(`${BASE}/graph/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  return r.json()
}

export async function clearSession(sessionId = 'default') {
  const r = await fetch(`${BASE}/chat/session/${sessionId}`, { method: 'DELETE' })
  return r.json()
}

export async function triggerIngest() {
  const r = await fetch(`${BASE}/ingest`, { method: 'POST' })
  return r.json()
}

/**
 * Streams chat response. Calls onEvent(type, data) for each SSE event.
 * Returns an AbortController — call .abort() to cancel.
 */
export function streamChat(message, history, onEvent, sessionId = 'default') {
  const ctrl = new AbortController()

  fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history, session_id: sessionId }),
    signal: ctrl.signal,
  }).then(async (res) => {
    const reader = res.body.getReader()
    const dec = new TextDecoder()
    let buf = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })

      // Parse SSE frames
      const frames = buf.split('\n\n')
      buf = frames.pop() // keep incomplete frame

      for (const frame of frames) {
        let eventType = 'message'
        let dataLine = ''
        for (const line of frame.split('\n')) {
          if (line.startsWith('event: ')) eventType = line.slice(7).trim()
          if (line.startsWith('data: ')) dataLine = line.slice(6)
        }
        if (!dataLine) continue
        let parsed
        try { parsed = JSON.parse(dataLine) } catch { parsed = dataLine }
        onEvent(eventType, parsed)
      }
    }
  }).catch((e) => {
    if (e.name !== 'AbortError') onEvent('error', e.message)
  })

  return ctrl
}
