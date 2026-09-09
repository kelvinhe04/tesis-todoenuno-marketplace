import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import Landing from './pages/Landing'
import Registro from './pages/Registro'
import Login from './pages/Login'
import Catalogo from './pages/Catalogo'
import ProductoDetalle from './pages/ProductoDetalle'
import Carrito from './pages/Carrito'
import Checkout from './pages/Checkout'
import Ordenes from './pages/Ordenes'
import Perfil from './pages/Perfil'
import VendedorPanel from './pages/vendedor/VendedorPanel'
import VendedorPublicaciones from './pages/vendedor/VendedorPublicaciones'
import VendedorCrearProducto from './pages/vendedor/VendedorCrearProducto'
import VendedorOrdenes from './pages/vendedor/VendedorOrdenes'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <Routes>
      <Route path="/registro" element={<Registro />} />
      <Route path="/login" element={<Login />} />

      <Route element={<Layout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/catalogo" element={<Catalogo />} />
        <Route path="/productos/:id" element={<ProductoDetalle />} />
        <Route
          path="/carrito"
          element={
            <ProtectedRoute>
              <Carrito />
            </ProtectedRoute>
          }
        />
        <Route
          path="/checkout"
          element={
            <ProtectedRoute>
              <Checkout />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ordenes"
          element={
            <ProtectedRoute>
              <Ordenes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/perfil"
          element={
            <ProtectedRoute>
              <Perfil />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>

      <Route
        path="/vendedor"
        element={
          <ProtectedRoute rol="vendedor">
            <VendedorPanel />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vendedor/publicaciones"
        element={
          <ProtectedRoute rol="vendedor">
            <VendedorPublicaciones />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vendedor/publicaciones/nueva"
        element={
          <ProtectedRoute rol="vendedor">
            <VendedorCrearProducto />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vendedor/publicaciones/:id/editar"
        element={
          <ProtectedRoute rol="vendedor">
            <VendedorCrearProducto />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vendedor/ordenes"
        element={
          <ProtectedRoute rol="vendedor">
            <VendedorOrdenes />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}
