import supabase from '../../lib/supabase.js'
import { success, error } from '../../lib/helpers.js'
import { authenticate, requireRole } from '../../lib/middleware.js'

export default async function handler(req, res) {
  try {
    const decoded = authenticate(req)

    if (req.method === 'GET') {
      const { data, error: dbError } = await supabase
        .from('branches')
        .select('*')
        .order('name', { ascending: true })

      if (dbError) return error(res, 'Could not fetch branches', 500)
      return success(res, data, 'Branches fetched')
    }

    if (req.method === 'POST') {
      requireRole(decoded, ['super_admin', 'admin'])
      const { name, address, phone, is_main } = req.body
      if (!name) return error(res, 'Branch name is required')

      const { data: branch, error: dbError } = await supabase
        .from('branches')
        .insert({ name, address: address || null, phone: phone || null, is_main: !!is_main })
        .select()
        .single()

      if (dbError) return error(res, 'Could not create branch', 500)

      await supabase.from('audit_logs').insert({
        user_id: decoded.id, action: 'create', entity_type: 'branch', entity_id: branch.id, new_value: branch
      })

      return success(res, branch, 'Branch created')
    }

    return error(res, 'Method not allowed', 405)
  } catch (err) {
    return error(res, err.message === 'Unauthorized' ? 'Unauthorized' : 'Server error', err.message === 'Unauthorized' ? 403 : 500)
  }
}
