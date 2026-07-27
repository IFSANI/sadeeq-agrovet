import supabase from '../../../lib/supabase.js'
import { success, error } from '../../../lib/helpers.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

export default async function handler(req, res) {
  if (req.method !== 'POST') return error(res, 'Method not allowed', 405)

  try {
    const { phone, password } = req.body
    if (!phone || !password) return error(res, 'Phone and password are required')

    const { data: customer, error: dbError } = await supabase.from('customers').select('*').eq('phone', phone).single()
    if (dbError || !customer || !customer.password) return error(res, 'Invalid phone or password', 401)

    const match = await bcrypt.compare(password, customer.password)
    if (!match) return error(res, 'Invalid phone or password', 401)

    const token = jwt.sign({ id: customer.id, role: 'customer' }, process.env.JWT_SECRET, { expiresIn: '30d' })

    return success(res, {
      token,
      customer: { id: customer.id, name: customer.name, phone: customer.phone, email: customer.email }
    }, 'Login successful')
  } catch (err) {
    return error(res, 'Server error', 500)
  }
}