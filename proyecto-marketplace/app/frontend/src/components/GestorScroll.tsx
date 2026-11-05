import { useEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

const CLAVE = 'mp_scroll'

function leer(): Record<string, number> {
  try {
    return JSON.parse(sessionStorage.getItem(CLAVE) || '{}')
  } catch {
    return {}
  }
}

// Navegación entre páginas: al ir a una página nueva se empieza arriba; al volver atrás/adelante se
// recupera la posición donde estabas. El navegador no lo logra solo porque el contenido llega después
// (productos cargados por API), así que se espera a que la página tenga altura suficiente.
export function GestorScroll() {
  const location = useLocation()
  const tipo = useNavigationType()
  const rutaAnterior = useRef<string | null>(null)

  useEffect(() => {
    window.history.scrollRestoration = 'manual'
  }, [])

  // Guarda la posición de la entrada actual del historial mientras se hace scroll
  useEffect(() => {
    let pendiente = 0
    const guardar = () => {
      const todo = leer()
      todo[location.key] = window.scrollY
      sessionStorage.setItem(CLAVE, JSON.stringify(todo))
    }
    const onScroll = () => {
      window.clearTimeout(pendiente)
      pendiente = window.setTimeout(guardar, 100)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.clearTimeout(pendiente)
    }
  }, [location.key])

  useEffect(() => {
    const cambioDePagina = rutaAnterior.current !== location.pathname
    rutaAnterior.current = location.pathname

    if (tipo === 'POP') {
      const destino = leer()[location.key] ?? 0
      if (destino === 0) {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
        return
      }
      // Espera (sin mover nada) a que el contenido asíncrono dé altura suficiente y salta de una vez,
      // para que no se vea deslizar la página. Máx. ~3 s; si no alcanza, va lo más lejos posible.
      let intentos = 0
      let raf = 0
      const saltar = () => window.scrollTo({ top: destino, left: 0, behavior: 'instant' })
      const intentar = () => {
        const maximo = document.documentElement.scrollHeight - window.innerHeight
        if (maximo >= destino - 1) {
          saltar()
          return
        }
        if (intentos++ < 180) raf = requestAnimationFrame(intentar)
        else saltar()
      }
      intentar()
      return () => cancelAnimationFrame(raf)
    }

    // PUSH/REPLACE a otra página: arriba. Mismo path (filtros del catálogo, etc.): se deja como está.
    if (cambioDePagina && !location.hash) window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [location.key, location.pathname, location.hash, tipo])

  return null
}
