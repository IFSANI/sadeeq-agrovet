import supabase from '../../lib/supabase.js'
import { success, error } from '../../lib/helpers.js'
import { authenticate, requireRole } from '../../lib/middleware.js'

export default async function handler(req, res) {
  try {
    const decoded = authenticate(req)
    const { id } = req.query

    if (req.method === 'GET') {
      const { data, error: dbError } = await supabase.from('products').select('*').eq('id', id).single()
      if (dbError || !data) return error(res, 'Product not found', 404)
      return success(res, data, 'Product fetched')
    }

    if (req.method === 'PUT') {
      requireRole(decoded, ['super_admin', 'admin'])
      const { data: existing } = await supabase.from('products').select('*').eq('id', id).single()
      if (!existing) return error(res, 'Product not found', 404)

      const allowed = ['name', 'category', 'drug_type', 'unit_of_measurement', 'weight', 'brand', 'barcode', 'price', 'is_active']
      const updates = {}
      for (const key of allowed) {
        if (req.body[key] !== undefined) updates[key] = req.body[key]
      }
      updates.updated_at = new Date()

      const { data: updated, error: dbError } = await supabase
        .from('products').update(updates).eq('id', id).select().single()

      if (dbError) return error(res, 'Could not update product', 500)

      await supabase.from('audit_logs').insert({
        user_id: decoded.id, action: 'update', entity_type: 'product', entity_id: id, old_value: existing, new_value: updated
      })

      return success(res, updated, 'Product updated')
    }

    if (req.method === 'DELETE') {
      requireRole(decoded, ['super_admin', 'admin'])
      const { data: existing } = await supabase.from('products').select('*').eq('id', id).single()
      if (!existing) return error(res, 'Product not found', 404)

      const { data: updated, error: dbError } = await supabase
        .from('products').update({ is_active: false, updated_at: new Date() }).eq('id', id).select().single()

      if (dbError) return error(res, 'Could not delete product', 500)

      await supabase.from('audit_logs').insert({
        user_id: decoded.id, action: 'delete', entity_type: 'product', entity_id: id, old_value: existing
      })

      return success(res, updated, 'Product deactivated')
    }

    return error(res, 'Method not allowed', 405)
  } catch (err) {
    return error(res, err.message === 'Unauthorized' ? 'Unauthorized' : 'Server error', err.message === 'Unauthorized' ? 403 : 500)
  }
}