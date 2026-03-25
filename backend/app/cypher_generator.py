"""
Translates natural language queries into Cypher via LLM.
Includes few-shot examples for the four main query patterns.
"""
import json
import re
from google import genai
from google.genai import types
from app.config import GEMINI_API_KEY
from app.schema_context import SCHEMA_CONTEXT


FEW_SHOT_EXAMPLES = """
=== FEW-SHOT CYPHER EXAMPLES ===

Q: Which products are associated with the highest number of billing documents?
A: {
  "cypher": "MATCH (p:Product)<-[:REFERENCES_MATERIAL]-(bi:BillingItem)<-[:HAS_ITEM]-(bd:BillingDocument) RETURN p.product AS product, coalesce(p.description, p.product) AS description, count(DISTINCT bd) AS billingDocCount ORDER BY billingDocCount DESC LIMIT 20",
  "intent": "aggregation",
  "summary": "Counting billing documents per product"
}

Q: Trace the full flow of billing document 90504248
A: {
  "cypher": "MATCH (bd:BillingDocument {billingDocument: '90504248'}) OPTIONAL MATCH (bd)-[:BILLED_TO]->(bp:BusinessPartner) OPTIONAL MATCH (bd)-[:HAS_ITEM]->(bi:BillingItem) OPTIONAL MATCH (bi)-[:BILLED_FROM]->(di:DeliveryItem) OPTIONAL MATCH (di)<-[:HAS_ITEM]-(od:OutboundDelivery) OPTIONAL MATCH (di)-[:FULFILLS]->(soi:SalesOrderItem) OPTIONAL MATCH (soi)<-[:HAS_ITEM]-(so:SalesOrder) OPTIONAL MATCH (bd)-[:POSTED_AS]->(je:JournalEntry) OPTIONAL MATCH (je)-[:CLEARED_BY]->(pay:Payment) RETURN bd, bp, bi, di, od, soi, so, je, pay",
  "intent": "trace_flow",
  "summary": "Full O2C flow for billing document"
}

Q: Show sales orders that have been delivered but not billed
A: {
  "cypher": "MATCH (so:SalesOrder)-[:HAS_ITEM]->(soi:SalesOrderItem)<-[:FULFILLS]-(di:DeliveryItem)<-[:HAS_ITEM]-(od:OutboundDelivery) WHERE NOT (di)<-[:BILLED_FROM]-(:BillingItem) RETURN DISTINCT so.salesOrder AS salesOrder, so.totalNetAmount AS amount, so.creationDate AS createdOn, od.deliveryDocument AS deliveryDocument LIMIT 50",
  "intent": "broken_flow",
  "summary": "Sales orders with delivery but no billing"
}

Q: Show sales orders billed without a delivery
A: {
  "cypher": "MATCH (bd:BillingDocument)-[:HAS_ITEM]->(bi:BillingItem) WHERE NOT (bi)-[:BILLED_FROM]->(:DeliveryItem) MATCH (bd)-[:BILLED_TO]->(bp:BusinessPartner) RETURN bd.billingDocument AS billingDocument, bd.totalNetAmount AS amount, bp.name AS customer, bd.creationDate AS createdOn LIMIT 50",
  "intent": "broken_flow",
  "summary": "Billing documents with no linked delivery"
}

Q: Show all billing documents for customer 310000108
A: {
  "cypher": "MATCH (bd:BillingDocument)-[:BILLED_TO]->(bp:BusinessPartner {businessPartner: '310000108'}) RETURN bd.billingDocument AS billingDocument, bd.totalNetAmount AS amount, bd.isCancelled AS isCancelled, bd.creationDate AS createdOn ORDER BY bd.creationDate DESC",
  "intent": "lookup",
  "summary": "Billing documents for a specific customer"
}

Q: Show the neighborhood of sales order 740506
A: {
  "cypher": "MATCH (so:SalesOrder {salesOrder: '740506'}) OPTIONAL MATCH (so)-[r1]->(n1) OPTIONAL MATCH (so)<-[r2]-(n2) RETURN so, r1, n1, r2, n2",
  "intent": "explore",
  "summary": "Graph neighborhood of sales order"
}

Q: Which customers have the highest outstanding amounts?
A: {
  "cypher": "MATCH (je:JournalEntry) WHERE je.clearingDate IS NULL OR je.clearingAccountingDocument IS NULL MATCH (bd:BillingDocument {accountingDocument: je.accountingDocument})-[:BILLED_TO]->(bp:BusinessPartner) RETURN bp.businessPartner AS customer, bp.name AS name, sum(je.amount) AS outstandingAmount ORDER BY outstandingAmount DESC LIMIT 20",
  "intent": "aggregation",
  "summary": "Customers with highest outstanding AR"
}

Q: Show cancelled billing documents
A: {
  "cypher": "MATCH (bd:BillingDocument {isCancelled: true}) OPTIONAL MATCH (bd)-[:BILLED_TO]->(bp:BusinessPartner) RETURN bd.billingDocument AS billingDocument, bd.totalNetAmount AS amount, bp.name AS customer, bd.creationDate AS createdOn ORDER BY bd.creationDate DESC LIMIT 50",
  "intent": "lookup",
  "summary": "Cancelled billing documents"
}

Q: List all plants and how many deliveries shipped from each
A: {
  "cypher": "MATCH (pl:Plant)<-[:SHIPPED_FROM]-(di:DeliveryItem)<-[:HAS_ITEM]-(od:OutboundDelivery) RETURN pl.plant AS plant, pl.plantName AS plantName, count(DISTINCT od) AS deliveryCount ORDER BY deliveryCount DESC",
  "intent": "aggregation",
  "summary": "Delivery count per plant"
}
"""

CYPHER_SYSTEM_PROMPT = f"""
{SCHEMA_CONTEXT}

{FEW_SHOT_EXAMPLES}

=== YOUR TASK ===
Given a natural language question about the O2C dataset, generate a valid Cypher query.

Rules:
1. Only use node labels and relationship types defined in the schema above.
2. Always use OPTIONAL MATCH for trace/explore queries so missing links don't drop results.
3. For aggregation queries, use RETURN with aliases and ORDER BY.
4. For trace/flow queries, return the full node objects (not just properties) so the frontend can render graph nodes.
5. Limit results to 100 unless the user asks for more.
6. Never use properties that are not listed in the schema.
7. Return ONLY a JSON object with keys: "cypher", "intent", "summary". No markdown, no explanation.

Intent values: "aggregation" | "trace_flow" | "broken_flow" | "lookup" | "explore"
"""


_client = None


def get_client():
    global _client
    if _client is None:
        _client = genai.Client(api_key=GEMINI_API_KEY)
    return _client


def generate_cypher(user_message: str, conversation_history: list = None) -> dict:
    """
    Returns {"cypher": str, "intent": str, "summary": str}
    """
    client = get_client()

    # Build contents list — new SDK uses Content objects with role "user" / "model"
    contents = []
    if conversation_history:
        for turn in conversation_history[-6:]:
            sdk_role = "model" if turn["role"] == "assistant" else "user"
            contents.append(
                types.Content(role=sdk_role, parts=[types.Part(text=turn["content"])])
            )
    contents.append(types.Content(role="user", parts=[types.Part(text=user_message)]))

    resp = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=CYPHER_SYSTEM_PROMPT,
            max_output_tokens=800,
        ),
    )

    raw = resp.text.strip()
    # Strip markdown fences
    raw = re.sub(r"^```[a-z]*\n?", "", raw)
    raw = re.sub(r"\n?```$", "", raw)

    try:
        return json.loads(raw.strip())
    except Exception:
        return {
            "cypher": raw,
            "intent": "lookup",
            "summary": "Query generated from natural language",
        }
