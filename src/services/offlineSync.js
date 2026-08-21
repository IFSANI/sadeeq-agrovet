import db from '../db'
import api from './api'
import { createSale, confirmCashPayment, confirmTransferPayment, confirmPOSPayment } from './salesService'

export function isOnline() {
  return navigator.onLine
}

export function generateOfflineId() {
  return `offline_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

// Pulls the branch's full product+stock list from the server and saves
// it locally. Call this whenever POS loads while online, so there's
// always a reasonably fresh cache ready if the connection drops later.
export async function refreshBranchCache(branchId) {
  if (!branchId || !isOnline()) return
  try {
    const res = await api.get('/api/products/branch/' + branchId)
    if (!res.data.success) return
    const products = res.data.data // shape: { product_id, products: {...}, ...stock fields per earlier confirmed pattern }

    await db.branch_product_cache.where('branch_id').equals(branchId).delete()
    const rows = products.map((p) => ({
      branch_id: branchId,
      product_id: p.product_id || p.id,
      name: p.products?.name || p.name,
      barcode: p.products?.barcode || p.barcode || null,
      category: p.products?.category || p.category,
      price: p.products?.price ?? p.price,
      wholesale_price: p.products?.wholesale_price ?? p.wholesale_price,
      unit_of_measurement: p.products?.unit_of_measurement || p.unit_of_measurement,
      quantity: p.stock?.quantity ?? p.quantity ?? 0,
      low_stock_threshold: p.stock?.low_stock_threshold ?? p.low_stock_threshold ?? 0,
    }))
    await db.branch_product_cache.bulkPut(rows)
  } catch {
    // silent — caching is best-effort, doesn't block anything
  }
}

// Used when offline: searches the local cache instead of hitting the API.
export async function searchLocalProducts(query, branchId) {
  if (!branchId || !query) return []
  const q = query.toLowerCase()
  const all = await db.branch_product_cache.where('branch_id').equals(branchId).toArray()
  return all
    .filter((p) => p.name?.toLowerCase().includes(q) || p.barcode === query)
    .map((p) => ({
      id: p.product_id,
      name: p.name,
      barcode: p.barcode,
      category: p.category,
      price: p.price,
      wholesale_price: p.wholesale_price,
      unit_of_measurement: p.unit_of_measurement,
      stock: { quantity: p.quantity, low_stock_threshold: p.low_stock_threshold },
    }))
}

// Queues a sale for later sync. Stores the exact payload we would have
// sent to the API, plus what's needed to confirm payment afterward.
export async function queueOfflineSale({ salePayload, upfrontAmount, upfrontMethod }) {
  const offlineId = generateOfflineId()
  await db.pending_sales.put({
    offline_id: offlineId,
    payload: { ...salePayload, offline_id: offlineId },
    upfront_amount: upfrontAmount,
    upfront_method: upfrontMethod,
    status: 'pending',
    error_message: null,
    created_at: new Date().toISOString(),
  })
  return offlineId
}

export async function getPendingSales() {
  const rows = await db.pending_sales.toArray()
  return rows.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
}

export async function getPendingCount() {
  return db.pending_sales.count()
}

export async function removePendingSale(offlineId) {
  await db.pending_sales.delete(offlineId)
}

export async function updatePendingSaleItems(offlineId, newItems, newTotal) {
  const row = await db.pending_sales.get(offlineId)
  if (!row) return
  row.payload.items = newItems
  row.payload.total_amount = newTotal
  row.status = 'pending'
  row.error_message = null
  await db.pending_sales.put(row)
}

// The sync engine. Call this whenever connectivity returns.
// Processes the queue oldest-first, one at a time, per the confirmed
// backend design (avoids the stock race condition).
export async function syncPendingSales(onProgress) {
  if (!isOnline()) return { synced: 0, failed: 0 }

  const pending = await getPendingSales()
  let synced = 0
  let failed = 0

  for (const item of pending) {
    if (item.status === 'cancelled') continue

    try {
      const saleRes = await createSale(item.payload)

      if (!saleRes.success) {
        await db.pending_sales.update(item.offline_id, {
          status: 'failed',
          error_message: saleRes.message || 'Failed to sync sale',
        })
        failed++
        onProgress?.({ synced, failed, total: pending.length })
        continue
      }

      const saleId = saleRes.data.id
      let paymentRes

      if (item.upfront_method === 'cash') {
        paymentRes = await confirmCashPayment(saleId, item.upfront_amount)
      } else if (item.upfront_method === 'transfer') {
        paymentRes = await confirmTransferPayment(saleId)
      } else if (item.upfront_method === 'pos') {
        paymentRes = await confirmPOSPayment(saleId)
      }

      if (paymentRes?.success) {
        await db.pending_sales.delete(item.offline_id)
        synced++
      } else {
        // Sale exists on the server now but payment confirm failed —
        // safe to retry just the confirm step next time since the
        // sale itself is already idempotent via offline_id.
        await db.pending_sales.update(item.offline_id, {
          status: 'failed',
          error_message: 'Sale synced but payment confirmation failed — will retry',
        })
        failed++
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Sync failed — will retry'
      await db.pending_sales.update(item.offline_id, {
        status: 'failed',
        error_message: message,
      })
      failed++
    }

    onProgress?.({ synced, failed, total: pending.length })
  }

  return { synced, failed }
}