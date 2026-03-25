import { useRef, useEffect, useCallback } from 'react'
import cytoscape from 'cytoscape'
import cola from 'cytoscape-cola'
import { NODE_COLORS, DEFAULT_NODE_COLOR } from './constants'

cytoscape.use(cola)

// ── Dot / cluster style ───────────────────────────────────────────────────────
const DOT_STYLE = [
  {
    selector: 'node',
    style: {
      label: '',
      width: 6, height: 6,
      shape: 'ellipse',
      'background-color': 'data(bg)',
      'border-color': 'data(border)',
      'border-width': 0.8,
      'background-opacity': 0.9,
    },
  },
  { selector: 'node.hub', style: { width: 11, height: 11, 'border-width': 1.4, 'background-opacity': 1 } },
  { selector: 'node:selected', style: { width: 14, height: 14, 'border-width': 2.5, 'border-color': '#6366f1', 'background-color': '#eef2ff' } },
  { selector: 'node.highlighted', style: { width: 13, height: 13, 'border-width': 2.5, 'border-color': '#f59e0b', 'background-color': '#fef3c7', 'background-opacity': 1 } },
  { selector: 'node.new-neighbour', style: { width: 13, height: 13, 'border-width': 2.5, 'border-color': '#6366f1', 'background-color': '#eef2ff', 'background-opacity': 1 } },
  { selector: 'node.dimmed', style: { opacity: 0.1 } },
  {
    selector: 'edge',
    style: {
      width: 0.8,
      'line-color': '#93c5fd',
      'target-arrow-shape': 'none',
      'curve-style': 'straight',
      opacity: 0.55,   // raised from 0.3 — edges now clearly visible
      label: '',
    },
  },
  { selector: 'edge.highlighted', style: { opacity: 1, width: 2, 'line-color': '#6366f1' } },
  { selector: 'edge.dimmed',      style: { opacity: 0.04 } },
]

// ── Detail style ──────────────────────────────────────────────────────────────
const DETAIL_STYLE = [
  {
    selector: 'node',
    style: {
      label: 'data(displayLabel)',
      'text-valign': 'center', 'text-halign': 'center',
      'font-size': '9px', 'font-weight': '600',
      'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      'text-wrap': 'wrap', 'text-max-width': '72px',
      width: 'data(size)', height: 'data(size)',
      shape: 'ellipse',
      'background-color': 'data(bg)', 'border-color': 'data(border)',
      'border-width': 1.5, color: 'data(textColor)', 'text-outline-width': 0,
    },
  },
  { selector: 'node:selected',     style: { 'border-width': 3, 'border-color': '#6366f1' } },
  { selector: 'node.highlighted',  style: { 'border-width': 3, 'border-color': '#f59e0b', 'background-color': '#fef3c7', color: '#92400e' } },
  { selector: 'node.new-neighbour',style: { 'border-width': 3, 'border-color': '#6366f1', 'background-color': '#eef2ff', color: '#3730a3' } },
  { selector: 'node.dimmed',       style: { opacity: 0.18 } },
  {
    selector: 'edge',
    style: {
      width: 1.2,
      'line-color': '#93c5fd',
      'target-arrow-color': '#6366f1',
      'target-arrow-shape': 'triangle',
      'arrow-scale': 0.7,
      'curve-style': 'bezier',
      opacity: 0.7,
      label: '',
      'font-size': '8px', color: '#6b7280',
      'text-background-color': '#f7f8fa', 'text-background-opacity': 0.9, 'text-background-padding': '2px',
    },
  },
  { selector: 'edge:selected', style: { 'line-color': '#6366f1', 'target-arrow-color': '#6366f1', opacity: 1, width: 2 } },
  { selector: 'edge.highlighted',  style: { opacity: 1, width: 2.5, 'line-color': '#6366f1', 'target-arrow-color': '#6366f1' } },
  { selector: 'edge.dimmed',       style: { opacity: 0.06 } },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function nodeColor(label) {
  return NODE_COLORS[label] || DEFAULT_NODE_COLOR
}

function calcDetailSize(degree) {
  return Math.min(60, Math.max(28, 28 + degree * 2.5))
}

function toNodeElements(nodes) {
  return nodes.map(n => {
    const c = nodeColor(n.label)
    return {
      group: 'nodes',
      data: {
        id: n.id,
        displayLabel: n.displayLabel || n.label,
        label: n.label,
        properties: n.properties,
        bg: c.bg,
        border: c.border,
        textColor: c.text,
        size: 32,
      },
    }
  })
}

function toEdgeElements(edges) {
  return edges.map(e => ({
    group: 'edges',
    data: {
      id: e.id,
      source: e.source,
      target: e.target,
      type: e.type,
      properties: e.properties,
    },
  }))
}

function applyHubClass(cy, threshold = 6) {
  cy.nodes().forEach(node => {
    if (node.degree(false) >= threshold) node.addClass('hub')
    else node.removeClass('hub')
  })
}

function applyDetailSize(cy) {
  cy.nodes().forEach(node => {
    node.data('size', calcDetailSize(node.degree(false)))
  })
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useGraph(containerRef, onNodeClick, onStatsChange) {
  const cyRef   = useRef(null)
  const modeRef = useRef('dot')
  // Stable ref so notifyStats never captures stale onStatsChange
  const statsCallbackRef = useRef(onStatsChange)
  useEffect(() => { statsCallbackRef.current = onStatsChange }, [onStatsChange])

  function notifyStats(cy) {
    if (statsCallbackRef.current && cy) {
      statsCallbackRef.current(cy.nodes().length, cy.edges().length)
    }
  }

  useEffect(() => {
    if (!containerRef.current) return

    cyRef.current = cytoscape({
      container: containerRef.current,
      style: DOT_STYLE,
      elements: [],
      wheelSensitivity: 0.25,
      minZoom: 0.02,
      maxZoom: 8,
    })

    const cy = cyRef.current

    // Node click
    cy.on('tap', 'node', (evt) => {
      const node = evt.target
      const renderedPos = evt.renderedPosition
      const container = containerRef.current
      const rect = container ? container.getBoundingClientRect() : { left: 0, top: 0 }
      onNodeClick && onNodeClick(
        {
          id: node.id(),
          label: node.data('label'),
          displayLabel: node.data('displayLabel'),
          properties: node.data('properties'),
          connectionCount: node.degree(false),
        },
        { x: rect.left + renderedPos.x, y: rect.top + renderedPos.y }
      )
    })

    // Hover: dim non-neighborhood — does NOT affect stats
    cy.on('mouseover', 'node', (evt) => {
      const node = evt.target
      const hood = node.closedNeighborhood()
      cy.elements().not(hood).addClass('dimmed')
      hood.removeClass('dimmed')
      hood.edges().addClass('highlighted')
    })
    cy.on('mouseout', 'node', () => {
      cy.elements().removeClass('dimmed highlighted')
    })

    // Zoom label reveal in dot mode
    cy.on('zoom', () => {
      if (modeRef.current !== 'dot') return
      const z = cy.zoom()
      cy.style()
        .selector('node')
        .style('label', z > 2.5 ? 'data(displayLabel)' : '')
        .style('font-size', '8px')
        .update()
    })

    return () => { cy.destroy() }
  }, []) // eslint-disable-line

  // ── Layouts ───────────────────────────────────────────────────────────────

  function runDotLayout(cy, onDone) {
    const layout = cy.layout({
      name: 'cose',
      animate: true,
      animationDuration: 800,
      randomize: false,        // false = incremental, keeps existing node positions stable
      componentSpacing: 50,
      nodeRepulsion: () => 3500,
      nodeOverlap: 6,
      idealEdgeLength: () => 55,
      edgeElasticity: () => 40,
      nestingFactor: 0.1,
      gravity: 0.3,
      numIter: 800,
      coolingFactor: 0.95,
      minTemp: 1.0,
      fit: false,              // false = don't re-fit on every layout, less jarring
      padding: 40,
    })
    layout.on('layoutstop', () => {
      applyHubClass(cy)
      onDone && onDone()
    })
    layout.run()
  }

  function runDetailLayout(cy, onDone) {
    if (cy.edges().length > 0) {
      try {
        const layout = cy.layout({
          name: 'cola',
          animate: true,
          randomize: false,
          maxSimulationTime: 1500,
          nodeSpacing: 18,
          edgeLength: 90,
          fit: false,
        })
        layout.on('layoutstop', () => {
          applyDetailSize(cy)
          onDone && onDone()
        })
        layout.run()
        return
      } catch (_) {}
    }
    const l = cy.layout({ name: 'cose', animate: true, randomize: false, fit: false })
    l.on('layoutstop', () => { applyDetailSize(cy); onDone && onDone() })
    l.run()
  }

  function runLayout(cy, onDone) {
    if (modeRef.current === 'dot') runDotLayout(cy, onDone)
    else runDetailLayout(cy, onDone)
  }

  // ── Public API ────────────────────────────────────────────────────────────

  const setViewMode = useCallback((mode) => {
    const cy = cyRef.current
    if (!cy) return
    modeRef.current = mode
    if (mode === 'dot') { cy.setStyle(DOT_STYLE); applyHubClass(cy) }
    else                { cy.setStyle(DETAIL_STYLE); applyDetailSize(cy) }
  }, [])

  // Returns: { newNodeCount, newEdgeCount, newNodeIds, totalNeighbourCount }
  // totalNeighbourCount = how many neighbours the DB returned (including already-present ones)
  // This lets callers distinguish "already all on canvas" from "truly no neighbours in DB"
  const addElements = useCallback((nodes, edges) => {
    const cy = cyRef.current
    if (!cy) return { newNodeCount: 0, newEdgeCount: 0, newNodeIds: [], totalNeighbourCount: 0 }

    const totalNeighbourCount = nodes.length  // raw count from DB response

    // Only add nodes not already in the graph
    const newNodeEls = toNodeElements(nodes).filter(el => !cy.getElementById(el.data.id).length)
    if (newNodeEls.length) cy.add(newNodeEls)

    // Only add edges where both endpoints exist and edge isn't already present
    const newEdgeEls = toEdgeElements(edges).filter(el => {
      if (cy.getElementById(el.data.id).length) return false
      return cy.getElementById(el.data.source).length > 0 &&
             cy.getElementById(el.data.target).length > 0
    })
    if (newEdgeEls.length) cy.add(newEdgeEls)

    const hadChanges = newNodeEls.length > 0 || newEdgeEls.length > 0

    if (hadChanges) {
      // Notify stats immediately (before layout) so count is always accurate
      notifyStats(cy)
      runLayout(cy)
    }

    return {
      newNodeCount: newNodeEls.length,
      newEdgeCount: newEdgeEls.length,
      newNodeIds: newNodeEls.map(el => el.data.id),
      totalNeighbourCount,
    }
  }, []) // eslint-disable-line

  const setElements = useCallback((nodes, edges) => {
    const cy = cyRef.current
    if (!cy) return
    cy.elements().remove()

    // Add nodes first, then edges — edges need both endpoints present
    cy.add(toNodeElements(nodes))
    const safeEdges = toEdgeElements(edges).filter(el =>
      cy.getElementById(el.data.source).length > 0 &&
      cy.getElementById(el.data.target).length > 0
    )
    if (safeEdges.length) cy.add(safeEdges)

    notifyStats(cy)
    runLayout(cy)
  }, []) // eslint-disable-line

  const highlightExpanded = useCallback((sourceId, newNodeIds) => {
    const cy = cyRef.current
    if (!cy) return

    cy.elements().removeClass('highlighted dimmed new-neighbour')

    const sourceEl  = cy.getElementById(sourceId)
    const newEls    = cy.collection(
      newNodeIds.map(id => cy.getElementById(id)).filter(el => el.length)
    )

    if (sourceEl.length) sourceEl.addClass('highlighted')
    newEls.addClass('new-neighbour')

    // Highlight all edges between source and new neighbours
    const connectingEdges = sourceEl.edgesWith(newEls)
    connectingEdges.addClass('highlighted')

    // Dim everything else
    const focused = sourceEl.union(newEls).union(connectingEdges)
    cy.elements().not(focused).addClass('dimmed')

    // Animate viewport to show source + all new neighbours
    const viewTarget = sourceEl.union(newEls)
    if (viewTarget.length > 0) {
      cy.animate({
        fit: { eles: viewTarget, padding: 100 },
        duration: 450,
        easing: 'ease-out-cubic',
      })
    }

    // Auto-clear after 5 seconds
    setTimeout(() => {
      if (cyRef.current) cyRef.current.elements().removeClass('highlighted dimmed new-neighbour')
    }, 5000)
  }, [])

  // Highlight from chat results (external IDs)
  const highlight = useCallback((ids) => {
    const cy = cyRef.current
    if (!cy) return
    cy.nodes().removeClass('highlighted')
    ids.forEach(id => {
      const el = cy.getElementById(id)
      if (el.length) el.addClass('highlighted')
    })
  }, [])

  // Full highlight for chat query results:
  // - highlights all result nodes
  // - highlights all edges between result nodes
  // - dims everything else
  // - fits viewport to result subgraph
  const highlightChatResults = useCallback((nodeIds, edges) => {
    const cy = cyRef.current
    if (!cy) return

    // Clear any previous highlights
    cy.elements().removeClass('highlighted dimmed new-neighbour')

    // Collect all result node elements present in the graph
    const resultEls = cy.collection(
      nodeIds.map(id => cy.getElementById(id)).filter(el => el.length)
    )

    if (resultEls.length === 0) return

    // Mark result nodes
    resultEls.addClass('highlighted')

    // Mark edges between result nodes (subgraph edges)
    const resultEdges = resultEls.edgesWith(resultEls)
    resultEdges.addClass('highlighted')

    // Also mark edges that were explicitly in the result set
    if (edges && edges.length > 0) {
      edges.forEach(e => {
        const el = cy.getElementById(e.id)
        if (el.length) el.addClass('highlighted')
      })
    }

    // Dim everything not in result set
    cy.elements().not(resultEls).not(resultEdges).addClass('dimmed')

    // Animate viewport to fit result nodes with generous padding
    cy.animate({
      fit: { eles: resultEls, padding: 80 },
      duration: 500,
      easing: 'ease-out-cubic',
    })

    // Auto-clear after 6 seconds
    setTimeout(() => {
      if (cyRef.current) cyRef.current.elements().removeClass('highlighted dimmed new-neighbour')
    }, 6000)
  }, [])

  const fit = useCallback(() => { cyRef.current?.fit(undefined, 40) }, [])

  const resetHighlight = useCallback(() => {
    cyRef.current?.elements().removeClass('highlighted dimmed new-neighbour')
  }, [])

  const setEdgeLabels = useCallback((show) => {
    const cy = cyRef.current
    if (!cy) return
    cy.style().selector('edge').style('label', show ? 'data(type)' : '').update()
  }, [])

  const getStats = useCallback(() => {
    const cy = cyRef.current
    return cy ? { nodes: cy.nodes().length, edges: cy.edges().length } : { nodes: 0, edges: 0 }
  }, [])

  return { addElements, setElements, highlight, highlightChatResults, highlightExpanded, fit, resetHighlight, setEdgeLabels, getStats, setViewMode }
}
