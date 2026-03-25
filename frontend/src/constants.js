// Node color palette — light theme, matches screenshot's blue-toned nodes
export const NODE_COLORS = {
  SalesOrder:       { bg: '#6ee7b7', border: '#059669', text: '#064e3b' },
  SalesOrderItem:   { bg: '#a7f3d0', border: '#6ee7b7', text: '#065f46' },
  ScheduleLine:     { bg: '#d1fae5', border: '#a7f3d0', text: '#065f46' },
  BillingDocument:  { bg: '#c4b5fd', border: '#7c3aed', text: '#2e1065' },
  BillingItem:      { bg: '#ddd6fe', border: '#c4b5fd', text: '#3b0764' },
  OutboundDelivery: { bg: '#93c5fd', border: '#2563eb', text: '#1e3a8a' },
  DeliveryItem:     { bg: '#bfdbfe', border: '#93c5fd', text: '#1e40af' },
  BusinessPartner:  { bg: '#fca5a5', border: '#dc2626', text: '#7f1d1d' },
  Product:          { bg: '#fdba74', border: '#ea580c', text: '#7c2d12' },
  Plant:            { bg: '#fcd34d', border: '#d97706', text: '#78350f' },
  JournalEntry:     { bg: '#d1d5db', border: '#6b7280', text: '#1f2937' },
  Payment:          { bg: '#e5e7eb', border: '#d1d5db', text: '#374151' },
}

export const DEFAULT_NODE_COLOR = { bg: '#e5e7eb', border: '#9ca3af', text: '#374151' }

export const EXAMPLE_QUERIES = [
  "Which products appear in the most billing documents?",
  "Trace the full flow of billing document 90504248",
  "Show sales orders that were delivered but never billed",
  "Show sales orders that were billed without any delivery",
  "Which customers have the most cancelled billing documents?",
  "List all plants and how many deliveries shipped from each",
  "Show all billing documents for customer 310000108",
  "Which sales orders have outstanding (uncleared) journal entries?",
]
