import supabase from '../../lib/supabase.js'
import { success, error } from '../../lib/helpers.js'
import { authenticate } from '../../lib/middleware.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return error(res, 'Method not allowed', 405)

  try {
    authenticate(req)
    const { q } = req.query
    if (!q) return error(res, 'Query parameter q is required')

    const { data, error: dbError } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .ilike('name', `%${q}%`)
      .order('name', { ascending: true })
      .limit(50)

    if (dbError) return error(res, 'Search failed', 500)
    return success(res, data, 'Search results')
  } catch (err) {
    return error(res, err.message === 'Unauthorized' ? 'Unauthorized' : 'Server error', err.message === 'Unauthorized' ? 403 : 500)
  }
}