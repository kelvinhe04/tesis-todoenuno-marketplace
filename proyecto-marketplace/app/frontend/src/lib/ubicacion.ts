export interface Coordenadas {
  lat: number
  lng: number
}

const NUM = '(-?\\d{1,3}(?:\\.\\d+)?)'

function valida(lat: number, lng: number): Coordenadas | null {
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null
}

// Saca las coordenadas de un enlace largo de Google Maps o de un texto tipo "8.9824, -79.5199".
// Formatos: .../@8.98,-79.51,15z · ...!3d8.98!4d-79.51 · ?q=8.98,-79.51 · ?ll= · ?query= · ?destination=
export function coordenadasDeTexto(texto: string): Coordenadas | null {
  let t = texto.trim()
  try {
    t = decodeURIComponent(t)
  } catch {
    // texto con % suelto: se usa tal cual
  }
  const patrones = [
    new RegExp(`!3d${NUM}!4d${NUM}`),
    new RegExp(`@${NUM},${NUM}`),
    new RegExp(`[?&](?:q|query|ll|destination|center)=${NUM},\\s*${NUM}`),
    new RegExp(`^${NUM}\\s*[,;\\s]\\s*${NUM}$`),
  ]
  for (const re of patrones) {
    const m = t.match(re)
    if (m) return valida(Number(m[1]), Number(m[2]))
  }
  return null
}

export function esEnlaceCortoGoogle(texto: string): boolean {
  return /(maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(texto)
}

export function esUrl(texto: string): boolean {
  return /^https?:\/\//i.test(texto.trim())
}

// Geocodificación con Nominatim (OpenStreetMap, sin clave de API)
export async function buscarDireccion(consulta: string): Promise<(Coordenadas & { nombre: string }) | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=es&q=${encodeURIComponent(consulta)}`
  const resp = await fetch(url)
  if (!resp.ok) throw new Error('El buscador de direcciones no respondió')
  const datos = (await resp.json()) as { lat: string; lon: string; display_name: string }[]
  if (datos.length === 0) return null
  return { lat: Number(datos[0].lat), lng: Number(datos[0].lon), nombre: datos[0].display_name }
}

export function urlGoogleMaps({ lat, lng }: Coordenadas): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
}
