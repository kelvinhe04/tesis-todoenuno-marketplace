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
  // Cada vez que cambia este número, el mapa se centra y acerca al pin (búsqueda / ubicación actual)
  enfocar?: number
}

export function MapaLocal({ lat, lng, editable = false, onChange, altura = '14rem', enfocar }: Props) {
  const contenedorRef = useRef<HTMLDivElement>(null)
  const mapaRef = useRef<L.Map | null>(null)
  const marcadorRef = useRef<L.Marker | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!contenedorRef.current || mapaRef.current) return
    const centro: [number, number] = lat !== undefined && lng !== undefined ? [lat, lng] : PANAMA
    const mapa = L.map(contenedorRef.current, { scrollWheelZoom: false }).setView(centro, lat !== undefined ? 15 : 12)
    // Vista satelital por defecto (Esri World Imagery, gratis y sin clave) con nombres de calles y lugares encima;
    // el selector de la esquina permite volver al mapa de calles de OpenStreetMap.
    const calles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    })
    const satelite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Imágenes &copy; Esri, Maxar, Earthstar Geographics',
      maxZoom: 19,
    })
    const etiquetas = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
    })
    const transporte = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
    })
    const vistaSatelite = L.layerGroup([satelite, transporte, etiquetas]).addTo(mapa)
    L.control.layers({ Satélite: vistaSatelite, Mapa: calles }, undefined, { position: 'topright' }).addTo(mapa)

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

  useEffect(() => {
    if (!enfocar || !mapaRef.current || lat === undefined || lng === undefined) return
    mapaRef.current.setView([lat, lng], 17)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enfocar])

  return <div ref={contenedorRef} style={{ height: altura, borderRadius: 'var(--radius-md)', overflow: 'hidden' }} />
}
