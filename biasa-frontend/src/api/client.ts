import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

const client = axios.create({ 
  baseURL: BASE_URL, 
  headers: { 'Content-Type': 'application/json' } 
})

client.interceptors.request.use((config) => { 
  const token = localStorage.getItem('biasa_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config 
})

client.interceptors.response.use((r) => r, (error) => { 
  if (error.response?.status === 401) { 
    localStorage.removeItem('biasa_token')
    window.location.href = '/login' 
  } 
  return Promise.reject(error) 
})

export default client
