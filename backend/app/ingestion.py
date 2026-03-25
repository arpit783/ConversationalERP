"""
Ingestion pipeline: reads all JSONL files and builds the Neo4j graph.
Uses UNWIND batching for all node loaders — much faster than one MERGE per record.
"""
import json
import os
import glob
from app.db import run_query
from app.config import DATA_DIR

BATCH_SIZE = 500


def read_jsonl(folder: str):
    records = []
    pattern = os.path.join(DATA_DIR, folder, "*.jsonl")
    for path in glob.glob(pattern):
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    records.append(json.loads(line))
    return records


def clean(val):
    """Convert empty strings / literal 'null' to None."""
    if val == "" or val == "null":
        return None
    return val


def batched(lst, n=BATCH_SIZE):
    for i in range(0, len(lst), n):
        yield lst[i:i + n]


# ── Constraint / index setup ──────────────────────────────────────────────────

CONSTRAINTS = [
    "CREATE CONSTRAINT IF NOT EXISTS FOR (n:SalesOrder) REQUIRE n.salesOrder IS UNIQUE",
    "CREATE CONSTRAINT IF NOT EXISTS FOR (n:SalesOrderItem) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT IF NOT EXISTS FOR (n:ScheduleLine) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT IF NOT EXISTS FOR (n:BillingDocument) REQUIRE n.billingDocument IS UNIQUE",
    "CREATE CONSTRAINT IF NOT EXISTS FOR (n:BillingItem) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT IF NOT EXISTS FOR (n:OutboundDelivery) REQUIRE n.deliveryDocument IS UNIQUE",
    "CREATE CONSTRAINT IF NOT EXISTS FOR (n:DeliveryItem) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT IF NOT EXISTS FOR (n:BusinessPartner) REQUIRE n.businessPartner IS UNIQUE",
    "CREATE CONSTRAINT IF NOT EXISTS FOR (n:Product) REQUIRE n.product IS UNIQUE",
    "CREATE CONSTRAINT IF NOT EXISTS FOR (n:Plant) REQUIRE n.plant IS UNIQUE",
    "CREATE CONSTRAINT IF NOT EXISTS FOR (n:JournalEntry) REQUIRE n.accountingDocument IS UNIQUE",
    "CREATE CONSTRAINT IF NOT EXISTS FOR (n:Payment) REQUIRE n.id IS UNIQUE",
]


def setup_constraints():
    for c in CONSTRAINTS:
        run_query(c)
    print("✓ Constraints created")


# ── Node loaders ──────────────────────────────────────────────────────────────

def load_sales_orders():
    records = read_jsonl("sales_order_headers")
    rows = [{
        "salesOrder": r["salesOrder"],
        "type": r.get("salesOrderType"),
        "salesOrg": r.get("salesOrganization"),
        "soldToParty": clean(r.get("soldToParty")),
        "amount": float(r.get("totalNetAmount") or 0),
        "currency": r.get("transactionCurrency"),
        "delStatus": clean(r.get("overallDeliveryStatus")),
        "creationDate": r.get("creationDate"),
        "rdDate": r.get("requestedDeliveryDate"),
        "payTerms": clean(r.get("customerPaymentTerms")),
    } for r in records]
    for batch in batched(rows):
        run_query("""
            UNWIND $rows AS r
            MERGE (n:SalesOrder {salesOrder: r.salesOrder})
            SET n.type = r.type, n.salesOrganization = r.salesOrg,
                n.soldToParty = r.soldToParty, n.totalNetAmount = r.amount,
                n.currency = r.currency, n.overallDeliveryStatus = r.delStatus,
                n.creationDate = r.creationDate, n.requestedDeliveryDate = r.rdDate,
                n.paymentTerms = r.payTerms,
                n.label = 'Sales order ' + r.salesOrder
        """, {"rows": batch})
    print(f"✓ SalesOrder nodes: {len(records)}")


def load_sales_order_items():
    records = read_jsonl("sales_order_items")
    rows = [{
        "id": f"{r['salesOrder']}-{r['salesOrderItem']}",
        "salesOrder": r["salesOrder"], "item": r["salesOrderItem"],
        "material": clean(r.get("material")),
        "qty": float(r.get("requestedQuantity") or 0),
        "unit": r.get("requestedQuantityUnit"),
        "amount": float(r.get("netAmount") or 0),
        "plant": clean(r.get("productionPlant")),
        "sloc": clean(r.get("storageLocation")),
    } for r in records]
    for batch in batched(rows):
        run_query("""
            UNWIND $rows AS r
            MERGE (n:SalesOrderItem {id: r.id})
            SET n.salesOrder = r.salesOrder, n.salesOrderItem = r.item,
                n.material = r.material, n.requestedQty = r.qty, n.unit = r.unit,
                n.netAmount = r.amount, n.productionPlant = r.plant,
                n.storageLocation = r.sloc,
                n.label = 'SO Item ' + r.salesOrder + '/' + r.item
        """, {"rows": batch})
    print(f"✓ SalesOrderItem nodes: {len(records)}")


def load_schedule_lines():
    records = read_jsonl("sales_order_schedule_lines")
    rows = [{
        "id": f"{r['salesOrder']}-{r['salesOrderItem']}-{r['scheduleLine']}",
        "salesOrder": r["salesOrder"], "item": r["salesOrderItem"],
        "sl": r["scheduleLine"],
        "cdd": r.get("confirmedDeliveryDate"),
        "qty": float(r.get("confdOrderQtyByMatlAvailCheck") or 0),
    } for r in records]
    for batch in batched(rows):
        run_query("""
            UNWIND $rows AS r
            MERGE (n:ScheduleLine {id: r.id})
            SET n.salesOrder = r.salesOrder, n.salesOrderItem = r.item,
                n.scheduleLine = r.sl, n.confirmedDeliveryDate = r.cdd,
                n.confirmedQty = r.qty,
                n.label = 'Schedule line ' + r.sl
        """, {"rows": batch})
    print(f"✓ ScheduleLine nodes: {len(records)}")


def load_billing_documents():
    headers = read_jsonl("billing_document_headers")
    cancels = read_jsonl("billing_document_cancellations")
    seen = {}
    for r in headers + cancels:
        bd = r["billingDocument"]
        if bd not in seen:
            seen[bd] = r
    rows = [{
        "bd": bd, "type": r.get("billingDocumentType"),
        "cancelled": bool(r.get("billingDocumentIsCancelled", False)),
        "cancelledBd": clean(r.get("cancelledBillingDocument")),
        "amount": float(r.get("totalNetAmount") or 0),
        "currency": r.get("transactionCurrency"),
        "accDoc": clean(r.get("accountingDocument")),
        "soldToParty": clean(r.get("soldToParty")),
        "fy": r.get("fiscalYear"),
        "creationDate": r.get("creationDate"),
    } for bd, r in seen.items()]
    for batch in batched(rows):
        run_query("""
            UNWIND $rows AS r
            MERGE (n:BillingDocument {billingDocument: r.bd})
            SET n.type = r.type, n.isCancelled = r.cancelled,
                n.cancelledBillingDocument = r.cancelledBd,
                n.totalNetAmount = r.amount, n.currency = r.currency,
                n.accountingDocument = r.accDoc, n.soldToParty = r.soldToParty,
                n.fiscalYear = r.fy, n.creationDate = r.creationDate,
                n.label = 'Billing doc ' + r.bd
        """, {"rows": batch})
    print(f"✓ BillingDocument nodes: {len(rows)}")


def load_billing_items():
    records = read_jsonl("billing_document_items")
    rows = [{
        "id": f"{r['billingDocument']}-{r['billingDocumentItem']}",
        "bd": r["billingDocument"], "item": r["billingDocumentItem"],
        "material": clean(r.get("material")),
        "qty": float(r.get("billingQuantity") or 0),
        "unit": r.get("billingQuantityUnit"),
        "amount": float(r.get("netAmount") or 0),
        "refSd": clean(r.get("referenceSdDocument")),
        "refSdItem": clean(r.get("referenceSdDocumentItem")),
    } for r in records]
    for batch in batched(rows):
        run_query("""
            UNWIND $rows AS r
            MERGE (n:BillingItem {id: r.id})
            SET n.billingDocument = r.bd, n.billingDocumentItem = r.item,
                n.material = r.material, n.billingQty = r.qty, n.unit = r.unit,
                n.netAmount = r.amount, n.referenceSdDocument = r.refSd,
                n.referenceSdDocumentItem = r.refSdItem,
                n.label = 'Billing item ' + r.bd + '/' + r.item
        """, {"rows": batch})
    print(f"✓ BillingItem nodes: {len(records)}")


def load_outbound_deliveries():
    records = read_jsonl("outbound_delivery_headers")
    rows = [{
        "dd": r["deliveryDocument"],
        "shippingPt": clean(r.get("shippingPoint")),
        "pickStatus": clean(r.get("overallPickingStatus")),
        "gmsStatus": clean(r.get("overallGoodsMovementStatus")),
        "creationDate": r.get("creationDate"),
    } for r in records]
    for batch in batched(rows):
        run_query("""
            UNWIND $rows AS r
            MERGE (n:OutboundDelivery {deliveryDocument: r.dd})
            SET n.shippingPoint = r.shippingPt, n.overallPickingStatus = r.pickStatus,
                n.overallGoodsMovementStatus = r.gmsStatus,
                n.creationDate = r.creationDate,
                n.label = 'Delivery ' + r.dd
        """, {"rows": batch})
    print(f"✓ OutboundDelivery nodes: {len(records)}")


def load_delivery_items():
    records = read_jsonl("outbound_delivery_items")
    rows = [{
        "id": f"{r['deliveryDocument']}-{r['deliveryDocumentItem']}",
        "dd": r["deliveryDocument"], "item": r["deliveryDocumentItem"],
        "qty": float(r.get("actualDeliveryQuantity") or 0),
        "unit": r.get("deliveryQuantityUnit"),
        "plant": clean(r.get("plant")),
        "sloc": clean(r.get("storageLocation")),
        "refSd": clean(r.get("referenceSdDocument")),
        "refSdItem": clean(r.get("referenceSdDocumentItem")),
    } for r in records]
    for batch in batched(rows):
        run_query("""
            UNWIND $rows AS r
            MERGE (n:DeliveryItem {id: r.id})
            SET n.deliveryDocument = r.dd, n.deliveryDocumentItem = r.item,
                n.actualDeliveryQty = r.qty, n.unit = r.unit,
                n.plant = r.plant, n.storageLocation = r.sloc,
                n.referenceSdDocument = r.refSd,
                n.referenceSdDocumentItem = r.refSdItem,
                n.label = 'Delivery item ' + r.dd + '/' + r.item
        """, {"rows": batch})
    print(f"✓ DeliveryItem nodes: {len(records)}")


def load_business_partners():
    bps = read_jsonl("business_partners")
    addrs = read_jsonl("business_partner_addresses")
    cca = read_jsonl("customer_company_assignments")
    csa = read_jsonl("customer_sales_area_assignments")

    addr_map = {a["businessPartner"]: a for a in addrs}
    cca_map = {c["customer"]: c for c in cca}
    csa_map = {c["customer"]: c for c in csa}

    rows = []
    for r in bps:
        bp = r["businessPartner"]
        addr = addr_map.get(bp, {})
        cc = cca_map.get(bp, {})
        cs = csa_map.get(bp, {})
        name = r.get("businessPartnerFullName") or r.get("businessPartnerName") or bp
        rows.append({
            "bp": bp, "name": name,
            "cat": r.get("businessPartnerCategory"),
            "blocked": bool(r.get("businessPartnerIsBlocked", False)),
            "city": addr.get("cityName"), "country": addr.get("country"),
            "postal": addr.get("postalCode"), "region": addr.get("region"),
            "street": addr.get("streetName"),
            "reconAcct": clean(cc.get("reconciliationAccount")),
            "payTerms": clean(cs.get("customerPaymentTerms")),
            "incoterms": clean(cs.get("incotermsClassification")),
            "currency": clean(cs.get("currency")),
        })
    for batch in batched(rows):
        run_query("""
            UNWIND $rows AS r
            MERGE (n:BusinessPartner {businessPartner: r.bp})
            SET n.name = r.name, n.category = r.cat, n.isBlocked = r.blocked,
                n.city = r.city, n.country = r.country, n.postalCode = r.postal,
                n.region = r.region, n.street = r.street,
                n.reconciliationAccount = r.reconAcct, n.paymentTerms = r.payTerms,
                n.incoterms = r.incoterms, n.currency = r.currency,
                n.label = r.name
        """, {"rows": batch})
    print(f"✓ BusinessPartner nodes: {len(rows)}")


def load_products():
    prods = read_jsonl("products")
    descs = read_jsonl("product_descriptions")
    desc_map = {d["product"]: d.get("productDescription") for d in descs}
    rows = [{
        "product": r["product"],
        "type": r.get("productType"), "group": r.get("productGroup"),
        "desc": desc_map.get(r["product"]),
        "gw": float(r.get("grossWeight") or 0),
        "nw": float(r.get("netWeight") or 0),
        "wu": r.get("weightUnit"), "bu": r.get("baseUnit"),
        "div": r.get("division"),
    } for r in prods]
    for batch in batched(rows):
        run_query("""
            UNWIND $rows AS r
            MERGE (n:Product {product: r.product})
            SET n.productType = r.type, n.productGroup = r.group,
                n.description = r.desc, n.grossWeight = r.gw, n.netWeight = r.nw,
                n.weightUnit = r.wu, n.baseUnit = r.bu, n.division = r.div,
                n.label = coalesce(r.desc, r.product)
        """, {"rows": batch})
    print(f"✓ Product nodes: {len(prods)}")


def load_plants():
    records = read_jsonl("plants")
    rows = [{
        "plant": r["plant"], "name": r.get("plantName"),
        "salesOrg": r.get("salesOrganization"),
        "dc": r.get("distributionChannel"), "cal": r.get("factoryCalendar"),
    } for r in records]
    for batch in batched(rows):
        run_query("""
            UNWIND $rows AS r
            MERGE (n:Plant {plant: r.plant})
            SET n.plantName = r.name, n.salesOrganization = r.salesOrg,
                n.distributionChannel = r.dc, n.factoryCalendar = r.cal,
                n.label = coalesce(r.name, r.plant)
        """, {"rows": batch})
    print(f"✓ Plant nodes: {len(records)}")


def load_journal_entries():
    records = read_jsonl("journal_entry_items_accounts_receivable")
    seen = {}
    for r in records:
        acc_doc = r.get("accountingDocument")
        if acc_doc and acc_doc not in seen:
            seen[acc_doc] = r
    rows = [{
        "accDoc": acc_doc,
        "gl": r.get("glAccount"),
        "refDoc": clean(r.get("referenceDocument")),
        "customer": clean(r.get("customer")),
        "amount": float(r.get("amountInTransactionCurrency") or 0),
        "currency": r.get("transactionCurrency"),
        "postingDate": r.get("postingDate"),
        "clearingDate": r.get("clearingDate"),
        "clearingDoc": clean(r.get("clearingAccountingDocument")),
        "fat": r.get("financialAccountType"),
        "pc": clean(r.get("profitCenter")),
    } for acc_doc, r in seen.items()]
    for batch in batched(rows):
        run_query("""
            UNWIND $rows AS r
            MERGE (n:JournalEntry {accountingDocument: r.accDoc})
            SET n.glAccount = r.gl, n.referenceDocument = r.refDoc,
                n.customer = r.customer, n.amount = r.amount,
                n.currency = r.currency, n.postingDate = r.postingDate,
                n.clearingDate = r.clearingDate,
                n.clearingAccountingDocument = r.clearingDoc,
                n.financialAccountType = r.fat, n.profitCenter = r.pc,
                n.label = 'Journal entry ' + r.accDoc
        """, {"rows": batch})
    print(f"✓ JournalEntry nodes: {len(rows)}")


def load_payments():
    records = read_jsonl("payments_accounts_receivable")
    rows = [{
        "id": f"{r.get('accountingDocument')}-{r.get('accountingDocumentItem', i)}",
        "accDoc": r.get("accountingDocument"),
        "clearingDoc": clean(r.get("clearingAccountingDocument")),
        "clearingDate": r.get("clearingDate"),
        "customer": clean(r.get("customer")),
        "amount": float(r.get("amountInTransactionCurrency") or 0),
        "currency": r.get("transactionCurrency"),
        "gl": r.get("glAccount"),
        "postingDate": r.get("postingDate"),
    } for i, r in enumerate(records)]
    for batch in batched(rows):
        run_query("""
            UNWIND $rows AS r
            MERGE (n:Payment {id: r.id})
            SET n.accountingDocument = r.accDoc,
                n.clearingAccountingDocument = r.clearingDoc,
                n.clearingDate = r.clearingDate, n.customer = r.customer,
                n.amount = r.amount, n.currency = r.currency,
                n.glAccount = r.gl, n.postingDate = r.postingDate,
                n.label = 'Payment ' + coalesce(r.clearingDoc, r.accDoc, r.id)
        """, {"rows": batch})
    print(f"✓ Payment nodes: {len(records)}")


# ── Edge builders ─────────────────────────────────────────────────────────────

def build_edges():
    print("Building edges...")

    run_query("""
        MATCH (so:SalesOrder), (soi:SalesOrderItem)
        WHERE soi.salesOrder = so.salesOrder
        MERGE (so)-[:HAS_ITEM]->(soi)
    """)
    print("  ✓ SalesOrder -[:HAS_ITEM]-> SalesOrderItem")

    run_query("""
        MATCH (soi:SalesOrderItem), (sl:ScheduleLine)
        WHERE sl.salesOrder = soi.salesOrder
          AND sl.salesOrderItem = soi.salesOrderItem
        MERGE (soi)-[:HAS_SCHEDULE_LINE]->(sl)
    """)
    print("  ✓ SalesOrderItem -[:HAS_SCHEDULE_LINE]-> ScheduleLine")

    run_query("""
        MATCH (so:SalesOrder), (bp:BusinessPartner)
        WHERE so.soldToParty = bp.businessPartner
        MERGE (so)-[:SOLD_TO]->(bp)
    """)
    print("  ✓ SalesOrder -[:SOLD_TO]-> BusinessPartner")

    run_query("""
        MATCH (soi:SalesOrderItem), (p:Product)
        WHERE soi.material = p.product
        MERGE (soi)-[:REFERENCES_MATERIAL]->(p)
    """)
    print("  ✓ SalesOrderItem -[:REFERENCES_MATERIAL]-> Product")

    run_query("""
        MATCH (od:OutboundDelivery), (di:DeliveryItem)
        WHERE di.deliveryDocument = od.deliveryDocument
        MERGE (od)-[:HAS_ITEM]->(di)
    """)
    print("  ✓ OutboundDelivery -[:HAS_ITEM]-> DeliveryItem")

    run_query("""
        MATCH (di:DeliveryItem), (pl:Plant)
        WHERE di.plant = pl.plant
        MERGE (di)-[:SHIPPED_FROM]->(pl)
    """)
    print("  ✓ DeliveryItem -[:SHIPPED_FROM]-> Plant")

    run_query("""
        MATCH (di:DeliveryItem), (soi:SalesOrderItem)
        WHERE di.referenceSdDocument = soi.salesOrder
          AND di.referenceSdDocumentItem = soi.salesOrderItem
        MERGE (di)-[:FULFILLS]->(soi)
    """)
    print("  ✓ DeliveryItem -[:FULFILLS]-> SalesOrderItem")

    run_query("""
        MATCH (bd:BillingDocument), (bi:BillingItem)
        WHERE bi.billingDocument = bd.billingDocument
        MERGE (bd)-[:HAS_ITEM]->(bi)
    """)
    print("  ✓ BillingDocument -[:HAS_ITEM]-> BillingItem")

    run_query("""
        MATCH (bi:BillingItem), (di:DeliveryItem)
        WHERE bi.referenceSdDocument = di.deliveryDocument
          AND bi.referenceSdDocumentItem = di.deliveryDocumentItem
        MERGE (bi)-[:BILLED_FROM]->(di)
    """)
    print("  ✓ BillingItem -[:BILLED_FROM]-> DeliveryItem")

    run_query("""
        MATCH (bd:BillingDocument), (bp:BusinessPartner)
        WHERE bd.soldToParty = bp.businessPartner
        MERGE (bd)-[:BILLED_TO]->(bp)
    """)
    print("  ✓ BillingDocument -[:BILLED_TO]-> BusinessPartner")

    run_query("""
        MATCH (bd:BillingDocument), (je:JournalEntry)
        WHERE bd.accountingDocument = je.accountingDocument
        MERGE (bd)-[:POSTED_AS]->(je)
    """)
    print("  ✓ BillingDocument -[:POSTED_AS]-> JournalEntry")

    run_query("""
        MATCH (je:JournalEntry), (pay:Payment)
        WHERE je.clearingAccountingDocument IS NOT NULL
          AND je.clearingAccountingDocument = pay.clearingAccountingDocument
        MERGE (je)-[:CLEARED_BY]->(pay)
    """)
    print("  ✓ JournalEntry -[:CLEARED_BY]-> Payment")

    run_query("""
        MATCH (bd:BillingDocument)
        WHERE bd.isCancelled = true
          AND bd.cancelledBillingDocument IS NOT NULL
        MATCH (orig:BillingDocument {billingDocument: bd.cancelledBillingDocument})
        MERGE (bd)-[:CANCELS]->(orig)
    """)
    print("  ✓ BillingDocument -[:CANCELS]-> BillingDocument")

    run_query("""
        MATCH (bi:BillingItem), (p:Product)
        WHERE bi.material = p.product
        MERGE (bi)-[:REFERENCES_MATERIAL]->(p)
    """)
    print("  ✓ BillingItem -[:REFERENCES_MATERIAL]-> Product")

    print("✓ All edges built")


def run_ingestion():
    print("=== Starting ingestion ===")
    setup_constraints()
    load_sales_orders()
    load_sales_order_items()
    load_schedule_lines()
    load_billing_documents()
    load_billing_items()
    load_outbound_deliveries()
    load_delivery_items()
    load_business_partners()
    load_products()
    load_plants()
    load_journal_entries()
    load_payments()
    build_edges()
    print("=== Ingestion complete ===")


if __name__ == "__main__":
    run_ingestion()
