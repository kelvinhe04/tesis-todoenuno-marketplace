import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import { CartProvider } from './context/CartContext.tsx'
import './index.css'

// Router de datos (en vez de <BrowserRouter>): permite bloquear la navegación con useBlocker cuando hay cambios sin guardar
const router = createBrowserRouter([
  {
    path: '*',
    element: (
      <AuthProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </AuthProvider>
    ),
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
