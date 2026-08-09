import express from 'express'
import supabase from '../lib/supabase.js'
import { success, error } from '../lib/helpers.js'
import { requireAuth, requireRole } from '../lib/middleware.js'

const router = express.Router()
router.use(requireAuth)
router.use(requireRole('super_admin', 'admin', 'cashier'))

router.get('/branch/:branchId', async (req, res) => {
  try {
    const { data, error: dbError } = await supabase
      .from('stock')
      .select('*, products(id, name, category, unit_of_measurement, price)')
      .eq('branch_id', req.params.branchId)
      .order('updated_at', { ascending: false })

    if (dbError) return error(res, 'Could not fetch stock', 500)
    return success(res, data, 'Stock fetched')
  } catch (err) {
    return error(res, 'Server error', 500)
  }
})

router.put('/branch/:branchId/product/:productId', requireRole('super_admin', 'admin'), async (req, res) => {
  try {
    const { branchId, productId } = req.params
    const { quantity, low_stock_threshold } = req.body

    const { data: existing } = await supabase.from('stock').select('*').eq('branch_id', branchId).eq('product_id', productId).single()
    if (!existing) return error(res, 'Stock record not found for this branch/product', 404)

    const updates = { updated_at: new Date() }
    if (quantity !== undefined) updates.quantity = quantity
    if (low_stock_threshold !== undefined) updates.low_stock_threshold = low_stock_threshold

    const { data: updated, error: dbError } = await supabase
      .from('stock').update(updates).eq('branch_id', branchId).eq('product_id', productId).select().single()

    if (dbError) return error(res, 'Could not update stock', 500)

    await supabase.from('audit_logs').insert({
      user_id: req.user.id, action: 'update', entity_type: 'stock', entity_id: updated.id, old_value: existing, new_value: updated
    })

    return success(res, updated, 'Stock updated')
  } catch (err) {
    return error(res, 'Server error', 500)
  }
})

router.get('/low-stock', async (req, res) => {
  try {
    const { branch } = req.query
    let query = supabase.from('stock').select('*, products(id, name, category, unit_of_measurement), branches(id, name)')
    if (branch) query = query.eq('branch_id', branch)

    const { data, error: dbError } = await query
    if (dbError) return error(res, 'Could not fetch stock', 500)

    const lowStock = (data || []).filter(row => Number(row.quantity) <= Number(row.low_stock_threshold))
    return success(res, lowStock, 'Low stock items fetched')
  } catch (err) {
    return error(res, 'Server error', 500)
  }
})

router.get('/restock', async (req, res) => {
  try {
    const { branch, from, to } = req.query
    let query = supabase
      .from('stock_receipts')
      .select('*, branches(name), suppliers(name), users:received_by(name), stock_receipt_items(*, products(name))')
      .order('created_at', { ascending: false })

    if (branch) query = query.eq('branch_id', branch)
    if (from) query = query.gte('created_at', from)
    if (to) query = query.lte('created_at', to)

    const { data, error: dbError } = await query
    if (dbError) return error(res, 'Could not fetch restock history', 500)
    return success(res, data, 'Restock history fetched')
  } catch (err) {
    return error(res, 'Server error', 500)
  }
})

router.post('/restock', requireRole('super_admin', 'admin'), async (req, res) => {
  try {
    const { branch_id, supplier_id, notes, items } = req.body

    if (!branch_id) return error(res, 'branch_id is required')
    if (!Array.isArray(items) || items.length === 0) return error(res, 'items array is required')
    for (const item of items) {
      if (!item.product_id || !item.quantity || item.cost_price === undefined) {
        return error(res, 'Each item needs product_id, quantity and cost_price')
      }
    }

    const total_cost = items.reduce((sum, i) => sum + (Number(i.quantity) * Number(i.cost_price)), 0)

    const { data: receipt, error: receiptErr } = await supabase
      .from('stock_receipts')
      .insert({ branch_id, supplier_id: supplier_id || null, received_by: req.user.id, total_cost, notes: notes || null })
      .select().single()

    if (receiptErr) return error(res, 'Could not create stock receipt', 500)

    const itemRows = items.map(i => ({ stock_receipt_id: receipt.id, product_id: i.product_id, quantity: i.quantity, cost_price: i.cost_price }))
    const { error: itemsErr } = await supabase.from('stock_receipt_items').insert(itemRows)
    if (itemsErr) return error(res, 'Could not save receipt items', 500)

    for (const item of items) {
      const { data: existingStock } = await supabase.from('stock').select('*').eq('branch_id', branch_id).eq('product_id', item.product_id).maybeSingle()

      if (existingStock) {
        await supabase.from('stock').update({ quantity: Number(existingStock.quantity) + Number(item.quantity), updated_at: new Date() }).eq('id', existingStock.id)
      } else {
        await supabase.from('stock').insert({ branch_id, product_id: item.product_id, quantity: item.quantity })
      }

      await supabase.from('branch_products').upsert({ branch_id, product_id: item.product_id, is_active: true }, { onConflict: 'branch_id,product_id' })
    }

    await supabase.from('audit_logs').insert({ user_id: req.user.id, action: 'create', entity_type: 'stock_receipt', entity_id: receipt.id, new_value: receipt })
    return success(res, { ...receipt, items }, 'Stock received and updated')
  } catch (err) {
    return error(res, 'Server error', 500)
  }
})

router.get('/transfer', async (req, res) => {
  try {
    const { status, branch } = req.query
    let query = supabase
      .from('stock_transfers')
      .select('*, from:from_branch_id(name), to:to_branch_id(name), stock_transfer_items(*, products(name))')
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)
    if (branch) query = query.or(`from_branch_id.eq.${branch},to_branch_id.eq.${branch}`)

    const { data, error: dbError } = await query
    if (dbError) return error(res, 'Could not fetch transfers', 500)
    return success(res, data, 'Transfers fetched')
  } catch (err) {
    return error(res, 'Server error', 500)
  }
})

router.post('/transfer', async (req, res) => {
  try {
    const { from_branch_id, to_branch_id, notes, items } = req.body

    if (!from_branch_id || !to_branch_id) return error(res, 'from_branch_id and to_branch_id are required')
    if (from_branch_id === to_branch_id) return error(res, 'from_branch_id and to_branch_id must differ')
    if (!Array.isArray(items) || items.length === 0) return error(res, 'items array is required')

    for (const item of items) {
      const { data: stockRow } = await supabase.from('stock').select('quantity').eq('branch_id', from_branch_id).eq('product_id', item.product_id).single()
      if (!stockRow || Number(stockRow.quantity) < Number(item.quantity)) {
        return error(res, `Insufficient stock for product ${item.product_id} at source branch`)
      }
    }

    const { data: transfer, error: transferErr } = await supabase
      .from('stock_transfers').insert({ from_branch_id, to_branch_id, initiated_by: req.user.id, notes: notes || null }).select().single()

    if (transferErr) return error(res, 'Could not create transfer', 500)

    const itemRows = items.map(i => ({ transfer_id: transfer.id, product_id: i.product_id, quantity: i.quantity }))
    await supabase.from('stock_transfer_items').insert(itemRows)

    for (const item of items) {
      const { data: stockRow } = await supabase.from('stock').select('*').eq('branch_id', from_branch_id).eq('product_id', item.product_id).single()
      await supabase.from('stock').update({ quantity: Number(stockRow.quantity) - Number(item.quantity), updated_at: new Date() }).eq('id', stockRow.id)
    }

    await supabase.from('audit_logs').insert({ user_id: req.user.id, action: 'create', entity_type: 'stock_transfer', entity_id: transfer.id, new_value: transfer })
    return success(res, { ...transfer, items }, 'Transfer created, stock reserved from source branch')
  } catch (err) {
    return error(res, 'Server error', 500)
  }
})

router.put('/transfer/:id/approve', requireRole('super_admin', 'admin'), async (req, res) => {
  try {
    const { id } = req.params
    const { data: transfer } = await supabase.from('stock_transfers').select('*').eq('id', id).single()
    if (!transfer) return error(res, 'Transfer not found', 404)
    if (transfer.status !== 'pending') return error(res, `Transfer is already ${transfer.status}`)

    const { data: updated, error: dbError } = await supabase
      .from('stock_transfers').update({ status: 'approved', approved_by: req.user.id }).eq('id', id).select().single()

    if (dbError) return error(res, 'Could not approve transfer', 500)

    await supabase.from('audit_logs').insert({ user_id: req.user.id, action: 'approve', entity_type: 'stock_transfer', entity_id: id, old_value: transfer, new_value: updated })
    return success(res, updated, 'Transfer approved')
  } catch (err) {
    return error(res, 'Server error', 500)
  }
})

router.put('/transfer/:id/receive', async (req, res) => {
  try {
    const { id } = req.params
    const { data: transfer } = await supabase.from('stock_transfers').select('*, stock_transfer_items(*)').eq('id', id).single()

    if (!transfer) return error(res, 'Transfer not found', 404)
    if (transfer.status !== 'approved') return error(res, 'Transfer must be approved before it can be received')

    for (const item of transfer.stock_transfer_items) {
      const { data: existingStock } = await supabase.from('stock').select('*').eq('branch_id', transfer.to_branch_id).eq('product_id', item.product_id).maybeSingle()

      if (existingStock) {
        await supabase.from('stock').update({ quantity: Number(existingStock.quantity) + Number(item.quantity), updated_at: new Date() }).eq('id', existingStock.id)
      } else {
        await supabase.from('stock').insert({ branch_id: transfer.to_branch_id, product_id: item.product_id, quantity: item.quantity })
      }

      await supabase.from('branch_products').upsert({ branch_id: transfer.to_branch_id, product_id: item.product_id, is_active: true }, { onConflict: 'branch_id,product_id' })
    }

    const { data: updated, error: dbError } = await supabase.from('stock_transfers').update({ status: 'received' }).eq('id', id).select().single()
    if (dbError) return error(res, 'Could not mark transfer as received', 500)

    await supabase.from('audit_logs').insert({ user_id: req.user.id, action: 'receive', entity_type: 'stock_transfer', entity_id: id, old_value: transfer, new_value: updated })
    return success(res, updated, 'Transfer received, stock updated at destination branch')
  } catch (err) {
    return error(res, 'Server error', 500)
  }
})

export default router