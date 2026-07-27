import supabase from '../../lib/supabase.js'
import { success, error } from '../../lib/helpers.js'
import { authenticate } from '../../lib/middleware.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return error(res, 'Method not allowed', 405)

  try {
    authenticate(req)
    const { branch } = req.query

    let query = supabase
      .from('stock')
      .select('*, products(id, name, category, unit_of_measurement), branches(id, name)')

    if (branch) query = query.eq('branch_id', branch)

    const { data, error: dbError } = await query
    if (dbError) return error(res, 'Could not fetch stock', 500)

    const lowStock = (data || []).filter(row => Number(row.quantity) <= Number(row.low_stock_threshold))
    return success(res, lowStock, 'Low stock items fetched')
  } catch (err) {
    return error(res, err.message === 'Unauthorized' ? 'Unauthorized' : 'Server error', err.message === 'Unauthorized' ? 403 : 500)
  }
}