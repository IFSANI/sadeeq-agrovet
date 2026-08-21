import Dexie from 'dexie'

const db = new Dexie('SadeeqAgrovetDB')

db.version(1).stores({
  products: 'id, name, category, barcode, branch_id',
  stock: 'id, product_id, branch_id',
  sales: 'id, offline_id, synced, created_at',
  sale_items: 'id, sale_id',
  payments: 'id, sale_id',
  carts: 'id, cashier_id, status',
  cart_items: 'id, cart_id',
  pending_sync: 'id, type, created_at'
})

// v2: adds local product+stock cache (needed for offline product search)
// and a proper offline sales queue. Old tables untouched so nothing
// that depends on them breaks.
db.version(2).stores({
  branch_product_cache: '[branch_id+product_id], branch_id, product_id, name, barcode',
  pending_sales: 'offline_id, status, created_at',
})

export default db