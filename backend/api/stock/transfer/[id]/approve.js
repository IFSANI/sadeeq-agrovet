import supabase from '../../../../lib/supabase.js'
import { success, error } from '../../../../lib/helpers.js'
import { authenticate, requireRole } from '../../../../lib/middleware.js'

export default async function handler(req, res) {
  if (req.method !== 'PUT') return error(res, 'Method not allowed', 405)

  try {
    const decoded = authenticate(req)
    requireRole(decoded, ['super_admin', 'admin'])

    const { id } = req.query
    const { data: transfer } = await supabase.from('stock_transfers').select('*').eq('id', id).single()
    if (!transfer) return error(res, 'Transfer not found', 404)
    if (transfer.status !== 'pending') return error(res, `Transfer is already ${transfer.status}`)

    const { data: updated, error: dbError } = await supabase
      .from('stock_transfers')
      .update({ status: 'approved', approved_by: decoded.id })
      .eq('id', id).select().single()

    if (dbError) return error(res, 'Could not approve transfer', 500)

    await supabase.from('audit_logs').insert({
      user_id: decoded.id, action: 'approve', entity_type: 'stock_transfer', entity_id: id, old_value: transfer, new_value: updated
    })

    return success(res, updated, 'Transfer approved')
  } catch (err) {
    return error(res, err.message === 'Unauthorized' ? 'Unauthorized' : 'Server error', err.message === 'Unauthorized' ? 403 : 500)
  }
}