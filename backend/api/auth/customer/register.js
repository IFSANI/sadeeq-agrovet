import supabase from '../../../lib/supabase.js'
import { success, error } from '../../../lib/helpers.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

export default async function handler(req, res) {
  if (req.method !== 'POST') return error(res, 'Method not allowed', 405)

  try {
    const { name, phone, email, password, address } = req.body
    if (!name || !phone || !password) return error(res, 'Name, phone and password are required')
    if (password.length < 6) return error(res, 'Password must be at least 6 characters')

    const { data: existing } = await supabase.from('customers').select('id').eq('phone', phone).maybeSingle()
    if (existing) return error(res, 'An account with this phone number already exists')

    const hashedPassword = await bcrypt.hash(password, 10)

    const { data: customer, error: dbError } = await supabase
      .from('customers')
      .insert({ name, phone, email: email || null, password: hashedPassword, address: address || null })
      .select()
      .single()

    if (dbError) return error(res, 'Could not create account', 500)

    const token = jwt.sign({ id: customer.id, role: 'customer' }, process.env.JWT_SECRET, { expiresIn: '30d' })

    return success(res, {
      token,
      customer: { id: customer.id, name: customer.name, phone: customer.phone, email: customer.email }
    }, 'Registration successful')
  } catch (err) {
    return error(res, 'Server error', 500)
  }
}