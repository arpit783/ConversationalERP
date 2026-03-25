"""
Formats raw Neo4j query results into graph-renderable nodes/edges
and clean tabular data for the frontend.

Handles two input types:
  - neo4j.Record objects  (from run_query_graph) — contains live Node/Relationship
  - plain dicts           (from run_query)        — scalars/aggregations only
"""
from neo4j.graph import Node, Relationship, Path


# ── Safe ID helpers (Neo4j 4.x uses int .id, 5.x uses str .element_id) ────────

def _nid(node: Node) -> str:
    try:
        return str(node.element_id)
    except AttributeError:
        return str(node.id)


def _rid(rel: Relationship) -> str:
    try:
        return str(rel.element_id)
    except AttributeError:
        return str(rel.id)


def _rsrc(rel: Relationship) -> str:
    try:
        return str(rel.start_node.element_id)
    except AttributeError:
        return str(rel.start_node.id)


def _rdst(rel: Relationship) -> str:
    try:
        return str(rel.end_node.element_id)
    except AttributeError:
        return str(rel.end_node.id)


# ── Serializers ────────────────────────────────────────────────────────────────

def serialize_node(node: Node) -> dict:
    labels = list(node.labels)
    props = dict(node.items())
    return {
        "id": _nid(node),
        "label": labels[0] if labels else "Unknown",
        "labels": labels,
        "properties": props,
        "displayLabel": (
            props.get("label") or props.get("name") or
            props.get("salesOrder") or props.get("billingDocument") or
            props.get("deliveryDocument") or props.get("product") or
            props.get("businessPartner") or props.get("accountingDocument") or
            _nid(node)
        ),
    }


def serialize_edge(rel: Relationship) -> dict:
    return {
        "id": _rid(rel),
        "source": _rsrc(rel),
        "target": _rdst(rel),
        "type": rel.type,
        "properties": dict(rel.items()),
    }


# ── Main formatter ─────────────────────────────────────────────────────────────

def format_results(records: list, intent: str) -> dict:
    """
    Accepts either:
      - list of neo4j.Record  (run_query_graph output)
      - list of dict          (run_query output — aggregations)

    Returns nodes, edges, table, highlight_ids, intent, count.
    """
    nodes_map = {}
    edges_map = {}
    table_rows = []

    for record in records:
        # Both neo4j.Record and dict expose .items() — works for both
        items = record.items()

        row = {}
        for key, val in items:
            if val is None:
                row[key] = None

            elif isinstance(val, Node):
                n = serialize_node(val)
                nodes_map[n["id"]] = n
                row[key] = n["displayLabel"]

            elif isinstance(val, Relationship):
                e = serialize_edge(val)
                edges_map[e["id"]] = e
                sn = serialize_node(val.start_node)
                en = serialize_node(val.end_node)
                nodes_map[sn["id"]] = sn
                nodes_map[en["id"]] = en
                row[key] = e["type"]

            elif isinstance(val, Path):
                for node in val.nodes:
                    n = serialize_node(node)
                    nodes_map[n["id"]] = n
                for rel in val.relationships:
                    e = serialize_edge(rel)
                    edges_map[e["id"]] = e
                row[key] = f"Path ({len(list(val.nodes))} nodes)"

            elif isinstance(val, list):
                # e.g. labels(n) returns a list
                row[key] = ", ".join(str(v) for v in val)

            else:
                row[key] = val

        table_rows.append(row)

    return {
        "nodes": list(nodes_map.values()),
        "edges": list(edges_map.values()),
        "table": table_rows,
        "highlight_ids": list(nodes_map.keys()),
        "intent": intent,
        "count": len(table_rows),
    }
