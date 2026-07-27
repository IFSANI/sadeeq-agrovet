import supabase from '../../../../lib/supabase.js'
import { success, error } from '../../../../lib/helpers.js'
import { authenticate } from '../../../../lib/middleware.js'

export default async function handler(req, res) {
  if (req.method !== 'PUT') return error(res, 'Method not allowed', 405)

  try {
    const decoded = authenticate(req)
    const { id } = req.query

    const { data: transfer } = await supabase
      .from('stock_transfers').select('*, stock_transfer_items(*)').eq('id', id).single()

    if (!transfer) return error(res, 'Transfer not found', 404)
    if (transfer.status !== 'approved') return error(res, 'Transfer must be approved before it can be received')

    for (const item of transfer.stock_transfer_items) {
      const { data: existingStock } = await supabase
        .from('stock').select('*').eq('branch_id', transfer.to_branch_id).eq('product_id', item.product_id).maybeSingle()

      if (existingStock) {
        await supabase.from('stock')
          .update({ quantity: Number(existingStock.quantity) + Number(item.quantity), updated_at: new Date() })
          .eq('id', existingStock.id)
      } else {
        await supabase.from('stock').insert({ branch_id: transfer.to_branch_id, product_id: item.product_id, quantity: item.quantity })
      }

      await supabase.from('branch_products')
        .upsert({ branch_id: transfer.to_branch_id, product_id: item.product_id, is_active: true }, { onConflict: 'branch_id,product_id' })
    }

    const { data: updated, error: dbError } = await supabase
      .from('stock_transfers')
      .update({ status: 'received' })
      .eq('id', id).select().single()

    if (dbError) return error(res, 'Could not mark transfer as received', 500)

    await supabase.from('audit_logs').insert({
      user_id: decoded.id, action: 'receive', entity_type: 'stock_transfer', entity_id: id, old_value: transfer, new_value: updated
    })

    return success(res, updated, 'Transfer received, stock updated at destination branch')
  } catch (err) {
    return error(res, err.message === 'Unauthorized' ? 'Unauthorized' : 'Server error', err.message === 'Unauthorized' ? 403 : 500)
  }
}