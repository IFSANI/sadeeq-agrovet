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

export default db