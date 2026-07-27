import supabase from '../../../lib/supabase.js'
import { success, error } from '../../../lib/helpers.js'
import { authenticate } from '../../../lib/middleware.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return error(res, 'Method not allowed', 405)

  try {
    authenticate(req)
    const { barcode } = req.query

    const { data, error: dbError } = await supabase
      .from('products').select('*').eq('barcode', barcode).eq('is_active', true).single()

    if (dbError || !data) return error(res, 'Product not found', 404)
    return success(res, data, 'Product fetched')
  } catch (err) {
    return error(res, err.message === 'Unauthorized' ? 'Unauthorized' : 'Server error', err.message === 'Unauthorized' ? 403 : 500)
  }
}