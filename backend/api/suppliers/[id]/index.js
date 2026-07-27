import supabase from '../../../lib/supabase.js'
import { success, error } from '../../../lib/helpers.js'
import { authenticate, requireRole } from '../../../lib/middleware.js'

export default async function handler(req, res) {
  try {
    const decoded = authenticate(req)
    const { id } = req.query

    if (req.method === 'GET') {
      const { data, error: dbError } = await supabase.from('suppliers').select('*').eq('id', id).single()
      if (dbError || !data) return error(res, 'Supplier not found', 404)
      return success(res, data, 'Supplier fetched')
    }

    if (req.method === 'PUT') {
      requireRole(decoded, ['super_admin', 'admin'])
      const { data: existing } = await supabase.from('suppliers').select('*').eq('id', id).single()
      if (!existing) return error(res, 'Supplier not found', 404)

      const allowed = ['name', 'phone', 'email', 'address']
      const updates = {}
      for (const key of allowed) if (req.body[key] !== undefined) updates[key] = req.body[key]

      const { data: updated, error: dbError } = await supabase.from('suppliers').update(updates).eq('id', id).select().single()
      if (dbError) return error(res, 'Could not update supplier', 500)

      await supabase.from('audit_logs').insert({
        user_id: decoded.id, action: 'update', entity_type: 'supplier', entity_id: id, old_value: existing, new_value: updated
      })

      return success(res, updated, 'Supplier updated')
    }

    if (req.method === 'DELETE') {
      requireRole(decoded, ['super_admin', 'admin'])
      const { data: existing } = await supabase.from('suppliers').select('*').eq('id', id).single()
      if (!existing) return error(res, 'Supplier not found', 404)

      const { error: dbError } = await supabase.from('suppliers').delete().eq('id', id)
      if (dbError) return error(res, 'Could not delete supplier — they may have existing stock receipts linked', 400)

      await supabase.from('audit_logs').insert({
        user_id: decoded.id, action: 'delete', entity_type: 'supplier', entity_id: id, old_value: existing
      })

      return success(res, {}, 'Supplier deleted')
    }

    return error(res, 'Method not allowed', 405)
  } catch (err) {
    return error(res, err.message === 'Unauthorized' ? 'Unauthorized' : 'Server error', err.message === 'Unauthorized' ? 403 : 500)
  }
}