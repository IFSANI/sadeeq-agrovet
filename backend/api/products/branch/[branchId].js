import supabase from '../../../lib/supabase.js'
import { success, error } from '../../../lib/helpers.js'
import { authenticate } from '../../../lib/middleware.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return error(res, 'Method not allowed', 405)

  try {
    authenticate(req)
    const { branchId } = req.query

    const { data, error: dbError } = await supabase
      .from('branch_products')
      .select('product_id, is_active, products(*), stock:stock(quantity, low_stock_threshold)')
      .eq('branch_id', branchId)
      .eq('is_active', true)

    if (dbError) return error(res, 'Could not fetch branch products', 500)
    return success(res, data, 'Branch products fetched')
  } catch (err) {
    return error(res, err.message === 'Unauthorized' ? 'Unauthorized' : 'Server error', err.message === 'Unauthorized' ? 403 : 500)
  }
}