import supabase from '../../lib/supabase.js'
import { success, error } from '../../lib/helpers.js'
import { authenticate, requireRole } from '../../lib/middleware.js'

export default async function handler(req, res) {
  try {
    const decoded = authenticate(req)

    if (req.method === 'GET') {
      const { data, error: dbError } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (dbError) return error(res, 'Could not fetch products', 500)
      return success(res, data, 'Products fetched')
    }

    if (req.method === 'POST') {
      requireRole(decoded, ['super_admin', 'admin'])
      const { name, category, drug_type, unit_of_measurement, weight, brand, barcode, price } = req.body

      if (!name || !category || !unit_of_measurement || price === undefined) {
        return error(res, 'name, category, unit_of_measurement and price are required')
      }

      const { data: product, error: dbError } = await supabase
        .from('products')
        .insert({ name, category, drug_type: drug_type || null, unit_of_measurement, weight: weight || null, brand: brand || null, barcode: barcode || null, price })
        .select()
        .single()

      if (dbError) {
        if (dbError.code === '23505') return error(res, 'A product with this barcode already exists')
        return error(res, 'Could not create product', 500)
      }

      await supabase.from('audit_logs').insert({
        user_id: decoded.id, action: 'create', entity_type: 'product', entity_id: product.id, new_value: product
      })

      return success(res, product, 'Product created')
    }

    return error(res, 'Method not allowed', 405)
  } catch (err) {
    return error(res, err.message === 'Unauthorized' ? 'Unauthorized' : 'Server error', err.message === 'Unauthorized' ? 403 : 500)
  }
}