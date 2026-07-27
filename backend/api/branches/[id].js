import supabase from '../../lib/supabase.js'
import { success, error } from '../../lib/helpers.js'
import { authenticate, requireRole } from '../../lib/middleware.js'

export default async function handler(req, res) {
  try {
    const decoded = authenticate(req)
    const { id } = req.query

    if (req.method === 'GET') {
      const { data, error: dbError } = await supabase.from('branches').select('*').eq('id', id).single()
      if (dbError || !data) return error(res, 'Branch not found', 404)
      return success(res, data, 'Branch fetched')
    }

    if (req.method === 'PUT') {
      requireRole(decoded, ['super_admin', 'admin'])
      const { data: existing } = await supabase.from('branches').select('*').eq('id', id).single()
      if (!existing) return error(res, 'Branch not found', 404)

      const { name, address, phone, is_main, is_active } = req.body
      const updates = {}
      if (name !== undefined) updates.name = name
      if (address !== undefined) updates.address = address
      if (phone !== undefined) updates.phone = phone
      if (is_main !== undefined) updates.is_main = is_main
      if (is_active !== undefined) updates.is_active = is_active

      const { data: updated, error: dbError } = await supabase
        .from('branches').update(updates).eq('id', id).select().single()

      if (dbError) return error(res, 'Could not update branch', 500)

      await supabase.from('audit_logs').insert({
        user_id: decoded.id, action: 'update', entity_type: 'branch', entity_id: id, old_value: existing, new_value: updated
      })

      return success(res, updated, 'Branch updated')
    }

    if (req.method === 'DELETE') {
      requireRole(decoded, ['super_admin', 'admin'])
      const { data: existing } = await supabase.from('branches').select('*').eq('id', id).single()
      if (!existing) return error(res, 'Branch not found', 404)

      const { data: updated, error: dbError } = await supabase
        .from('branches').update({ is_active: false }).eq('id', id).select().single()

      if (dbError) return error(res, 'Could not delete branch', 500)

      await supabase.from('audit_logs').insert({
        user_id: decoded.id, action: 'delete', entity_type: 'branch', entity_id: id, old_value: existing
      })

      return success(res, updated, 'Branch deactivated')
    }

    return error(res, 'Method not allowed', 405)
  } catch (err) {
    return error(res, err.message === 'Unauthorized' ? 'Unauthorized' : 'Server error', err.message === 'Unauthorized' ? 403 : 500)
  }
}