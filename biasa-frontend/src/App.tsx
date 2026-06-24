import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { useEffect } from 'react'
import { useAuthStore } from './store/auth'
import { authApi } from './api/auth'

export default function App() {
  const { token, setAuth, logout } = useAuthStore()

  useEffect(() => {
    if (!token) return
    authApi.me()
      .then(user => setAuth(user, token))
      .catch(() => logout())
  }, [])

  return <RouterProvider router={router} />
}
