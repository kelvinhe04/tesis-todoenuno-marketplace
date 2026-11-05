import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ApiError } from '../lib/api'
import { ConfirmModal } from './ConfirmModal'

interface Props {
  className?: string
  texto?: string
  // Qué mostrar a quien ya es vendedor; null = no mostrar nada
  textoVendedor?: string | null
  onAntesDeNavegar?: () => void
}

// Acción única para "empezar a vender": registra a quien no tiene cuenta, activa el modo vendedor
// al comprador (con confirmación) y lleva al panel al que ya es vendedor.
export function BotonVender({ className = 'btn', texto = 'Quiero vender', textoVendedor = 'Ir a mi panel de vendedor', onAntesDeNavegar }: Props) {
  const { usuario, activarVendedor } = useAuth()
  const navigate = useNavigate()
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!usuario) {
    return (
      <Link to="/registro" className={className} onClick={onAntesDeNavegar}>
        {texto}
      </Link>
    )
  }

  if (usuario.rol === 'vendedor') {
    if (textoVendedor === null) return null
    return (
      <Link to="/vendedor" className={className} onClick={onAntesDeNavegar}>
        {textoVendedor}
      </Link>
    )
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setConfirmando(true)}>
        {texto}
      </button>
      <ConfirmModal
        abierto={confirmando}
        titulo="Activar modo vendedor"
        mensaje={
          error ??
          'Podrás publicar productos y servicios desde tu panel de vendedor, y seguirás pudiendo comprar con esta misma cuenta. No se puede desactivar después, pero puedes pausar tus publicaciones.'
        }
        textoConfirmar="Activar"
        onConfirmar={async () => {
          setError(null)
          try {
            await activarVendedor()
            setConfirmando(false)
            onAntesDeNavegar?.()
            navigate('/vendedor')
          } catch (err) {
            setError(err instanceof ApiError ? err.message : 'No se pudo activar el modo vendedor')
          }
        }}
        onCancelar={() => {
          setConfirmando(false)
          setError(null)
        }}
      />
    </>
  )
}
