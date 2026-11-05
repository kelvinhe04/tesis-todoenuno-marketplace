import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ApiError, pagosApi } from '../lib/api'
import { PantallaConfirmando, PantallaResultado } from '../components/PantallasPago'

// Página a la que PayU devuelve al comprador (responseUrl). Los parámetros vienen firmados; el servidor valida la
// firma, que la orden sea suya y el monto exacto antes de aprobar el pago.
export default function CheckoutPayu() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const iniciado = useRef(false)
  const [estado, setEstado] = useState<'confirmando' | 'aprobado' | 'rechazado'>('confirmando')
  const [motivo, setMotivo] = useState<string | undefined>()

  useEffect(() => {
    if (iniciado.current) return
    iniciado.current = true
    const params = Object.fromEntries(searchParams.entries())
    if (!params.referenceCode || !params.signature) {
      navigate('/ordenes', { replace: true })
      return
    }
    const pausa = new Promise((r) => setTimeout(r, 1100)) // que "Confirmando…" se alcance a ver
    pagosApi
      .payuConfirmar(params)
      .then(async (pago) => {
        await pausa
        if (pago.estado === 'aprobado') setEstado('aprobado')
        else {
          setMotivo(pago.motivoRechazo || 'PayU no aprobó el pago')
          setEstado('rechazado')
        }
      })
      .catch(async (err) => {
        await pausa
        setMotivo(err instanceof ApiError ? err.message : 'No se pudo confirmar el pago con PayU')
        setEstado('rechazado')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (estado === 'confirmando') return <PantallaConfirmando pasarela="PayU" />
  return <PantallaResultado aprobado={estado === 'aprobado'} motivo={motivo} onVerOrdenes={() => navigate('/ordenes')} />
}
