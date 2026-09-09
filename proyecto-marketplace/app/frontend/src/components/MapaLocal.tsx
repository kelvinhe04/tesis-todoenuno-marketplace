import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const ICONO = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

const PANAMA: [number, number] = [8.9824, -79.5199]

interface Props {
  lat?: number
  lng?: number
  editable?: boolean
  onChange?: (lat: number, lng: number) => void
  altura?: string
}

export function MapaLocal({ lat, lng, editable = false, onChange, altura = '14rem' }: Props) {
  const contenedorRef = useRef<HTMLDivElement>(null)
  const mapaRef = useRef<L.Map | null>(null)
  const marcadorRef = useRef<L.Marker | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!contenedorRef.current || mapaRef.current) return
    const centro: [number, number] = lat !== undefined && lng !== undefined ? [lat, lng] : PANAMA
    const mapa = L.map(contenedorRef.current, { scrollWheelZoom: false }).setView(centro, lat !== undefined ? 15 : 12)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(mapa)

    if (lat !== undefined && lng !== undefined) {
      marcadorRef.current = L.marker([lat, lng], { icon: ICONO, draggable: editable }).addTo(mapa)
      marcadorRef.current.on('dragend', () => {
        const pos = marcadorRef.current!.getLatLng()
        onChangeRef.current?.(pos.lat, pos.lng)
      })
    }

    if (editable) {
      mapa.on('click', (e: L.LeafletMouseEvent) => {
        const { lat: nlat, lng: nlng } = e.latlng
        if (marcadorRef.current) {
          marcadorRef.current.setLatLng(e.latlng)
        } else {
          marcadorRef.current = L.marker(e.latlng, { icon: ICONO, draggable: true }).addTo(mapa)
          marcadorRef.current.on('dragend', () => {
            const pos = marcadorRef.current!.getLatLng()
            onChangeRef.current?.(pos.lat, pos.lng)
          })
        }
        onChangeRef.current?.(nlat, nlng)
      })
    }

    mapaRef.current = mapa
    setTimeout(() => mapa.invalidateSize(), 150)

    return () => {
      mapa.remove()
      mapaRef.current = null
      marcadorRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable])

  useEffect(() => {
    if (!mapaRef.current || lat === undefined || lng === undefined) return
    if (marcadorRef.current) {
      marcadorRef.current.setLatLng([lat, lng])
    } else {
      marcadorRef.current = L.marker([lat, lng], { icon: ICONO, draggable: editable }).addTo(mapaRef.current)
    }
  }, [lat, lng, editable])

  return <div ref={contenedorRef} style={{ height: altura, borderRadius: 'var(--radius-md)', overflow: 'hidden' }} />
}
