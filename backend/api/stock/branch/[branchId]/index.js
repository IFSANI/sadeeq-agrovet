import supabase from '../../../../lib/supabase.js'
import { success, error } from '../../../../lib/helpers.js'
import { authenticate } from '../../../../lib/middleware.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return error(res, 'Method not allowed', 405)

  try {
    authenticate(req)
    const { branchId } = req.query

    const { data, error: dbError } = await supabase
      .from('stock')
      .select('*, products(id, name, category, unit_of_measurement, price)')
      .eq('branch_id', branchId)
      .order('updated_at', { ascending: false })

    if (dbError) return error(res, 'Could not fetch stock', 500)
    return success(res, data, 'Stock fetched')
  } catch (err) {
    return error(res, err.message === 'Unauthorized' ? 'Unauthorized' : 'Server error', err.message === 'Unauthorized' ? 403 : 500)
  }
}
