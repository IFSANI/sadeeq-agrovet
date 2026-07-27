import supabase from '../../../../../lib/supabase.js'
import { success, error } from '../../../../../lib/helpers.js'
import { authenticate, requireRole } from '../../../../../lib/middleware.js'

export default async function handler(req, res) {
  if (req.method !== 'PUT') return error(res, 'Method not allowed', 405)

  try {
    const decoded = authenticate(req)
    requireRole(decoded, ['super_admin', 'admin'])

    const { branchId, productId } = req.query
    const { quantity, low_stock_threshold } = req.body

    const { data: existing } = await supabase
      .from('stock').select('*').eq('branch_id', branchId).eq('product_id', productId).single()

    if (!existing) return error(res, 'Stock record not found for this branch/product', 404)

    const updates = { updated_at: new Date() }
    if (quantity !== undefined) updates.quantity = quantity
    if (low_stock_threshold !== undefined) updates.low_stock_threshold = low_stock_threshold

    const { data: updated, error: dbError } = await supabase
      .from('stock').update(updates)
      .eq('branch_id', branchId).eq('product_id', productId)
      .select().single()

    if (dbError) return error(res, 'Could not update stock', 500)

    await supabase.from('audit_logs').insert({
      user_id: decoded.id, action: 'update', entity_type: 'stock',
      entity_id: updated.id, old_value: existing, new_value: updated
    })

    return success(res, updated, 'Stock updated')
  } catch (err) {
    return error(res, err.message === 'Unauthorized' ? 'Unauthorized' : 'Server error', err.message === 'Unauthorized' ? 403 : 500)
  }
}