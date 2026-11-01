import { useState } from 'react'
import { buscarDireccion, coordenadasDeTexto, esEnlaceCortoGoogle, esUrl, urlGoogleMaps, type Coordenadas } from '../lib/ubicacion'

interface Props {
  ubicacion: Coordenadas | null
  // direccion = texto sugerido cuando viene de una búsqueda por dirección
  onUbicacion: (coords: Coordenadas, direccion?: string) => void
}

const MENSAJES_GEO: Record<number, string> = {
  1: 'Permiso de ubicación denegado. Actívalo en tu navegador o usa la búsqueda.',
  2: 'No se pudo determinar tu ubicación. Prueba con la búsqueda.',
  3: 'Tardó demasiado en obtener tu ubicación. Inténtalo de nuevo.',
}

// Tres formas de colocar el pin además del clic en el mapa: ubicación actual, búsqueda por dirección y enlace de Google Maps.
export function BuscadorUbicacion({ ubicacion, onUbicacion }: Props) {
  const [texto, setTexto] = useState('')
  const [ocupado, setOcupado] = useState<'buscando' | 'ubicando' | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)

  const usarMiUbicacion = () => {
    if (!navigator.geolocation) {
      setMensaje('Tu navegador no permite obtener la ubicación.')
      return
    }
    setMensaje(null)
    setOcupado('ubicando')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onUbicacion({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setOcupado(null)
      },
      (err) => {
        setMensaje(MENSAJES_GEO[err.code] ?? 'No se pudo obtener tu ubicación.')
        setOcupado(null)
      },
      { enableHighAccuracy: true, timeout: 15000 },
    )
  }

  const buscar = async () => {
    const consulta = texto.trim()
    if (!consulta) return
    setMensaje(null)

    const coords = coordenadasDeTexto(consulta)
    if (coords) {
      onUbicacion(coords)
      return
    }
    if (esEnlaceCortoGoogle(consulta)) {
      setMensaje('Los enlaces cortos (maps.app.goo.gl) no se pueden leer. Ábrelo y pega la dirección larga de la barra del navegador, o busca por dirección.')
      return
    }
    if (esUrl(consulta)) {
      setMensaje('No encontré coordenadas en ese enlace. Usa el enlace largo de Google Maps o busca por dirección.')
      return
    }

    setOcupado('buscando')
    try {
      const resultado = await buscarDireccion(consulta)
      if (resultado) onUbicacion({ lat: resultado.lat, lng: resultado.lng }, resultado.nombre)
      else setMensaje('No se encontró esa dirección. Prueba con más detalles (calle, ciudad) o haz clic en el mapa.')
    } catch {
      setMensaje('No se pudo buscar la dirección. Inténtalo de nuevo o haz clic en el mapa.')
    } finally {
      setOcupado(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <input
          className="input"
          style={{ flex: '1 1 100%' }}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              buscar()
            }
          }}
          placeholder="Buscar dirección o pegar enlace de Google Maps"
          aria-label="Buscar dirección o pegar enlace de Google Maps"
        />
        <button type="button" className="btn btn-sm" onClick={buscar} disabled={ocupado !== null || !texto.trim()}>
          {ocupado === 'buscando' ? 'Buscando...' : 'Buscar'}
        </button>
        <button type="button" className="btn btn-sm" onClick={usarMiUbicacion} disabled={ocupado !== null}>
          {ocupado === 'ubicando' ? 'Ubicando...' : '📍 Usar mi ubicación actual'}
        </button>
      </div>
      {mensaje && <p className="error-text">{mensaje}</p>}
      {ubicacion && (
        <a href={urlGoogleMaps(ubicacion)} target="_blank" rel="noopener noreferrer" className="hint-text" style={{ fontWeight: 600 }}>
          Ver este punto en Google Maps ↗
        </a>
      )}
    </div>
  )
}
