"""
Graph exploration API: node neighborhood expansion, search, overview stats.
"""
from app.db import run_query, run_query_graph
from app.result_formatter import serialize_node, serialize_edge


def get_neighborhood(node_id: str, depth: int = 1) -> dict:
    """
    Returns immediate neighbors of a node by its Neo4j element ID.
    Used for expand-on-click in the graph explorer.
    """
    records = run_query_graph(
        """
        MATCH (n)
        WHERE elementId(n) = $nodeId
        OPTIONAL MATCH (n)-[r]-(m)
        RETURN n, r, m
        LIMIT 80
        """,
        {"nodeId": node_id},
    )

    nodes_map = {}
    edges_map = {}

    for rec in records:
        n = rec.get("n")
        r = rec.get("r")
        m = rec.get("m")

        if n:
            sn = serialize_node(n)
            nodes_map[sn["id"]] = sn
        if m:
            sm = serialize_node(m)
            nodes_map[sm["id"]] = sm
        if r:
            se = serialize_edge(r)
            edges_map[se["id"]] = se

    return {
        "nodes": list(nodes_map.values()),
        "edges": list(edges_map.values()),
    }


def search_nodes(query: str, limit: int = 30) -> dict:
    """Full-text search over node labels/IDs. Used for the search bar."""
    records = run_query_graph(
        """
        MATCH (n)
        WHERE toLower(n.label) CONTAINS toLower($q)
           OR toLower(coalesce(n.salesOrder,'')) CONTAINS toLower($q)
           OR toLower(coalesce(n.billingDocument,'')) CONTAINS toLower($q)
           OR toLower(coalesce(n.deliveryDocument,'')) CONTAINS toLower($q)
           OR toLower(coalesce(n.product,'')) CONTAINS toLower($q)
           OR toLower(coalesce(n.businessPartner,'')) CONTAINS toLower($q)
           OR toLower(coalesce(n.description,'')) CONTAINS toLower($q)
           OR toLower(coalesce(n.name,'')) CONTAINS toLower($q)
        RETURN n
        LIMIT $limit
        """,
        {"q": query, "limit": limit},
    )
    nodes = []
    for rec in records:
        node = rec.get("n")
        if node:
            nodes.append(serialize_node(node))
    return {"nodes": nodes}


def get_overview_stats() -> dict:
    """Returns node and edge counts for the dashboard header."""
    node_counts = run_query(
        "MATCH (n) RETURN labels(n)[0] AS label, count(n) AS count ORDER BY count DESC"
    )
    edge_counts = run_query(
        "MATCH ()-[r]->() RETURN type(r) AS type, count(r) AS count ORDER BY count DESC"
    )
    total_nodes = run_query("MATCH (n) RETURN count(n) AS total")
    total_edges = run_query("MATCH ()-[r]->() RETURN count(r) AS total")
    return {
        "node_counts": node_counts,
        "edge_counts": edge_counts,
        "total_nodes": total_nodes[0]["total"] if total_nodes else 0,
        "total_edges": total_edges[0]["total"] if total_edges else 0,
    }


def get_initial_graph(limit: int = 500) -> dict:
    """
    Returns a large representative subgraph for the cluster dot view.
    Samples broadly across all node types so natural type-clusters form.
    """
    nodes_map = {}
    edges_map = {}

    # Sample each node type proportionally
    type_queries = [
        ("MATCH (n:SalesOrder)-[r]->(m) RETURN n,r,m LIMIT 60", ["n","m"], ["r"]),
        ("MATCH (n:SalesOrderItem)-[r]->(m) RETURN n,r,m LIMIT 60", ["n","m"], ["r"]),
        ("MATCH (n:BillingDocument)-[r]->(m) RETURN n,r,m LIMIT 60", ["n","m"], ["r"]),
        ("MATCH (n:BillingItem)-[r]->(m) RETURN n,r,m LIMIT 40", ["n","m"], ["r"]),
        ("MATCH (n:OutboundDelivery)-[r]->(m) RETURN n,r,m LIMIT 40", ["n","m"], ["r"]),
        ("MATCH (n:DeliveryItem)-[r]->(m) RETURN n,r,m LIMIT 40", ["n","m"], ["r"]),
        ("MATCH (n:BusinessPartner)-[r]-(m) RETURN n,r,m LIMIT 30", ["n","m"], ["r"]),
        ("MATCH (n:JournalEntry)-[r]-(m) RETURN n,r,m LIMIT 30", ["n","m"], ["r"]),
        ("MATCH (n:Payment)-[r]-(m) RETURN n,r,m LIMIT 20", ["n","m"], ["r"]),
        ("MATCH (n:Product)-[r]-(m) RETURN n,r,m LIMIT 20", ["n","m"], ["r"]),
        ("MATCH (n:Plant)-[r]-(m) RETURN n,r,m LIMIT 10", ["n","m"], ["r"]),
    ]

    for cypher, node_keys, rel_keys in type_queries:
        try:
            records = run_query_graph(cypher, {})
            for rec in records:
                for k in node_keys:
                    node = rec.get(k)
                    if node:
                        sn = serialize_node(node)
                        nodes_map[sn["id"]] = sn
                for k in rel_keys:
                    r = rec.get(k)
                    if r:
                        se = serialize_edge(r)
                        edges_map[se["id"]] = se
        except Exception:
            pass

    return {
        "nodes": list(nodes_map.values()),
        "edges": list(edges_map.values()),
    }
