import api from './api'

export const getProducts = async (branchId) => {
  const response = await api.get(`/api/products/branch/${branchId}`)
  return response.data
}

export const searchProducts = async (query) => {
  const response = await api.get(`/api/products/search?q=${query}`)
  return response.data
}

export const getProductByBarcode = async (barcode) => {
  const response = await api.get(`/api/products/barcode/${barcode}`)
  return response.data
}