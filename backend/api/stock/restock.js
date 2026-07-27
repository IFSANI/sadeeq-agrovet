import supabase from '../../lib/supabase.js'
import { success, error } from '../../lib/helpers.js'
import { authenticate, requireRole } from '../../lib/middleware.js'

export default async function handler(req, res) {
  try {
    const decoded = authenticate(req)

    if (req.method === 'GET') {
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
    }

    if (req.method === 'POST') {
      requireRole(decoded, ['super_admin', 'admin'])
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
        .insert({ branch_id, supplier_id: supplier_id || null, received_by: decoded.id, total_cost, notes: notes || null })
        .select().single()

      if (receiptErr) return error(res, 'Could not create stock receipt', 500)

      const itemRows = items.map(i => ({
        stock_receipt_id: receipt.id, product_id: i.product_id, quantity: i.quantity, cost_price: i.cost_price
      }))
      const { error: itemsErr } = await supabase.from('stock_receipt_items').insert(itemRows)
      if (itemsErr) return error(res, 'Could not save receipt items', 500)

      for (const item of items) {
        const { data: existingStock } = await supabase
          .from('stock').select('*').eq('branch_id', branch_id).eq('product_id', item.product_id).maybeSingle()

        if (existingStock) {
          await supabase.from('stock')
            .update({ quantity: Number(existingStock.quantity) + Number(item.quantity), updated_at: new Date() })
            .eq('id', existingStock.id)
        } else {
          await supabase.from('stock').insert({ branch_id, product_id: item.product_id, quantity: item.quantity })
        }

        await supabase.from('branch_products')
          .upsert({ branch_id, product_id: item.product_id, is_active: true }, { onConflict: 'branch_id,product_id' })
      }

      await supabase.from('audit_logs').insert({
        user_id: decoded.id, action: 'create', entity_type: 'stock_receipt', entity_id: receipt.id, new_value: receipt
      })

      return success(res, { ...receipt, items }, 'Stock received and updated')
    }

    return error(res, 'Method not allowed', 405)
  } catch (err) {
    return error(res, err.message === 'Unauthorized' ? 'Unauthorized' : 'Server error', err.message === 'Unauthorized' ? 403 : 500)
  }
}