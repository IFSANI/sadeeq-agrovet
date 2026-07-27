import supabase from '../../../lib/supabase.js'
import { success, error } from '../../../lib/helpers.js'
import { authenticate } from '../../../lib/middleware.js'

export default async function handler(req, res) {
  try {
    const decoded = authenticate(req)

    if (req.method === 'GET') {
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
    }

    if (req.method === 'POST') {
      const { from_branch_id, to_branch_id, notes, items } = req.body

      if (!from_branch_id || !to_branch_id) return error(res, 'from_branch_id and to_branch_id are required')
      if (from_branch_id === to_branch_id) return error(res, 'from_branch_id and to_branch_id must differ')
      if (!Array.isArray(items) || items.length === 0) return error(res, 'items array is required')

      for (const item of items) {
        const { data: stockRow } = await supabase
          .from('stock').select('quantity').eq('branch_id', from_branch_id).eq('product_id', item.product_id).single()

        if (!stockRow || Number(stockRow.quantity) < Number(item.quantity)) {
          return error(res, `Insufficient stock for product ${item.product_id} at source branch`)
        }
      }

      const { data: transfer, error: transferErr } = await supabase
        .from('stock_transfers')
        .insert({ from_branch_id, to_branch_id, initiated_by: decoded.id, notes: notes || null })
        .select().single()

      if (transferErr) return error(res, 'Could not create transfer', 500)

      const itemRows = items.map(i => ({ transfer_id: transfer.id, product_id: i.product_id, quantity: i.quantity }))
      await supabase.from('stock_transfer_items').insert(itemRows)

      for (const item of items) {
        const { data: stockRow } = await supabase
          .from('stock').select('*').eq('branch_id', from_branch_id).eq('product_id', item.product_id).single()

        await supabase.from('stock')
          .update({ quantity: Number(stockRow.quantity) - Number(item.quantity), updated_at: new Date() })
          .eq('id', stockRow.id)
      }

      await supabase.from('audit_logs').insert({
        user_id: decoded.id, action: 'create', entity_type: 'stock_transfer', entity_id: transfer.id, new_value: transfer
      })

      return success(res, { ...transfer, items }, 'Transfer created, stock reserved from source branch')
    }

    return error(res, 'Method not allowed', 405)
  } catch (err) {
    return error(res, err.message === 'Unauthorized' ? 'Unauthorized' : 'Server error', err.message === 'Unauthorized' ? 403 : 500)
  }
}