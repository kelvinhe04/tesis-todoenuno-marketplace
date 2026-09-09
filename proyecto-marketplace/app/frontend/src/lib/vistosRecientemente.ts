const CLAVE = 'mp_vistos'
const MAX_VISTOS = 10

export function registrarVisto(productoId: string) {
  try {
    const actuales = obtenerVistos().filter((id) => id !== productoId)
    actuales.unshift(productoId)
    localStorage.setItem(CLAVE, JSON.stringify(actuales.slice(0, MAX_VISTOS)))
  } catch {
    // localStorage no disponible (modo privado, etc.) — no es crítico, se ignora.
  }
}

export function obtenerVistos(): string[] {
  try {
    const crudo = localStorage.getItem(CLAVE)
    if (!crudo) return []
    const lista = JSON.parse(crudo)
    return Array.isArray(lista) ? lista.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}
