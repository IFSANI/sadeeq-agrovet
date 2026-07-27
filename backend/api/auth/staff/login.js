import supabase from '../../../lib/supabase.js'
import { success, error } from '../../../lib/helpers.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

export default async function handler(req, res) {
  if (req.method !== 'POST') return error(res, 'Method not allowed', 405)

  try {
    const { email, password } = req.body
    if (!email || !password) return error(res, 'Email and password are required')

    const { data: user, error: dbError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('is_active', true)
      .single()

    if (dbError || !user) return error(res, 'Invalid email or password', 401)

    const passwordMatch = await bcrypt.compare(password, user.password)
    if (!passwordMatch) return error(res, 'Invalid email or password', 401)

    const token = jwt.sign(
      { id: user.id, role: user.role, branch_id: user.branch_id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    return success(res, {
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, branch_id: user.branch_id }
    }, 'Login successful')
  } catch (err) {
    return error(res, 'Server error', 500)
  }
}