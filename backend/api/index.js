import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import authRoutes from '../routes/auth.js'
import staffRoutes from '../routes/staff.js'
import customerRoutes from '../routes/customers.js'
import branchRoutes from '../routes/branches.js'
import productRoutes from '../routes/products.js'
import stockRoutes from '../routes/stock.js'
import supplierRoutes from '../routes/suppliers.js'

const app = express()
app.use(cors())
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/staff', staffRoutes)
app.use('/api/customers', customerRoutes)
app.use('/api/branches', branchRoutes)
app.use('/api/products', productRoutes)
app.use('/api/stock', stockRoutes)
app.use('/api/suppliers', supplierRoutes)

export default app