import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { carritoApi } from '../lib/api'
import { useAuth } from './AuthContext'

interface CartContextValue {
  cantidadItems: number
  refrescar: () => Promise<void>
}

const CartContext = createContext<CartContextValue | undefined>(undefined)

export function CartProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth()
  const [cantidadItems, setCantidadItems] = useState(0)

  const refrescar = useCallback(async () => {
    if (!usuario) {
      setCantidadItems(0)
      return
    }
    try {
      const carrito = await carritoApi.obtener()
      setCantidadItems(carrito.items.reduce((acc, it) => acc + it.cantidad, 0))
    } catch {
      setCantidadItems(0)
    }
  }, [usuario])

  useEffect(() => {
    refrescar()
  }, [refrescar])

  return <CartContext.Provider value={{ cantidadItems, refrescar }}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart debe usarse dentro de CartProvider')
  return ctx
}
