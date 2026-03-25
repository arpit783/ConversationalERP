from neo4j import GraphDatabase
from app.config import NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD

_driver = None


def get_driver():
    global _driver
    if _driver is None:
        _driver = GraphDatabase.driver(
            NEO4J_URI,
            auth=(NEO4J_USER, NEO4J_PASSWORD),
            max_connection_lifetime=3600,
            connection_acquisition_timeout=30,
        )
    return _driver


def close_driver():
    global _driver
    if _driver:
        _driver.close()
        _driver = None


def run_query(cypher: str, params: dict = None):
    """
    Returns records as plain Python dicts (scalars, lists).
    Use for aggregation queries and MERGE/CREATE writes.
    """
    driver = get_driver()
    with driver.session() as session:
        result = session.run(cypher, params or {})
        return [record.data() for record in result]


def run_query_graph(cypher: str, params: dict = None):
    """
    Returns raw Neo4j Record objects preserving Node/Relationship types.
    Records are eagerly consumed inside the session so they remain valid
    after the session closes.
    """
    driver = get_driver()
    with driver.session() as session:
        result = session.run(cypher, params or {})
        # Eagerly materialise — records become detached/invalid after session closes
        records = list(result)
    return records
