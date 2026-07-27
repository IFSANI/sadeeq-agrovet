import supabase from '../../lib/supabase.js'
import { success, error } from '../../lib/helpers.js'
import { authenticate, requireRole } from '../../lib/middleware.js'

export default async function handler(req, res) {
  try {
    const decoded = authenticate(req)

    if (req.method === 'GET') {
      const { data, error: dbError } = await supabase.from('suppliers').select('*').order('name', { ascending: true })
      if (dbError) return error(res, 'Could not fetch suppliers', 500)
      return success(res, data, 'Suppliers fetched')
    }

    if (req.method === 'POST') {
      requireRole(decoded, ['super_admin', 'admin'])
      const { name, phone, email, address } = req.body
      if (!name) return error(res, 'Supplier name is required')

      const { data: supplier, error: dbError } = await supabase
        .from('suppliers').insert({ name, phone: phone || null, email: email || null, address: address || null }).select().single()

      if (dbError) return error(res, 'Could not create supplier', 500)

      await supabase.from('audit_logs').insert({
        user_id: decoded.id, action: 'create', entity_type: 'supplier', entity_id: supplier.id, new_value: supplier
      })

      return success(res, supplier, 'Supplier created')
    }

    return error(res, 'Method not allowed', 405)
  } catch (err) {
    return error(res, err.message === 'Unauthorized' ? 'Unauthorized' : 'Server error', err.message === 'Unauthorized' ? 403 : 500)
  }
}