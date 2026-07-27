import jwt from 'jsonwebtoken'

export function authenticate(req) {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) throw new Error('No token provided')
  const decoded = jwt.verify(token, process.env.JWT_SECRET)
  return decoded
}

export function requireRole(decoded, roles) {
  if (!roles.includes(decoded.role)) {
    throw new Error('Unauthorized')
  }
}