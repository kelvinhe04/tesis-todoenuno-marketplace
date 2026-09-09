import { useEffect, useRef, useState } from 'react'
import { ProductCard } from './ProductCard'
import { catalogoApi, type Producto } from '../lib/api'
import { obtenerVistos } from '../lib/vistosRecientemente'
import { IconChevronLeft, IconChevronRight } from './icons'
import styles from './VistosRecientemente.module.css'

export function VistosRecientemente({ excluirId }: { excluirId?: string }) {
  const [productos, setProductos] = useState<Producto[] | null>(null)
  const [puedeIzq, setPuedeIzq] = useState(false)
  const [puedeDer, setPuedeDer] = useState(false)
  const rowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ids = obtenerVistos().filter((id) => id !== excluirId)
    if (ids.length === 0) {
      setProductos([])
      return
    }
    Promise.all(ids.map((id) => catalogoApi.obtener(id).catch(() => null))).then((resultados) => {
      setProductos(resultados.filter((p): p is Producto => p !== null))
    })
  }, [excluirId])

  const actualizarFlechas = () => {
    const el = rowRef.current
    if (!el) return
    setPuedeIzq(el.scrollLeft > 4)
    setPuedeDer(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  useEffect(() => {
    actualizarFlechas()
    window.addEventListener('resize', actualizarFlechas)
    return () => window.removeEventListener('resize', actualizarFlechas)
  }, [productos])

  const desplazar = (direccion: 1 | -1) => {
    const el = rowRef.current
    if (!el) return
    el.scrollBy({ left: direccion * el.clientWidth, behavior: 'smooth' })
  }

  if (!productos || productos.length === 0) return null

  return (
    <section style={{ marginTop: '2.5rem' }}>
      <div className={styles.heading}>
        <h2 style={{ fontSize: '1.25rem' }}>Vistos recientemente</h2>
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.arrow}
            onClick={() => desplazar(-1)}
            disabled={!puedeIzq}
            aria-label="Ver anteriores"
          >
            <IconChevronLeft />
          </button>
          <button
            type="button"
            className={styles.arrow}
            onClick={() => desplazar(1)}
            disabled={!puedeDer}
            aria-label="Ver más"
          >
            <IconChevronRight />
          </button>
        </div>
      </div>
      <div className={styles.row} ref={rowRef} onScroll={actualizarFlechas}>
        {productos.map((p) => (
          <div key={p._id} className={styles.item}>
            <ProductCard producto={p} />
          </div>
        ))}
      </div>
    </section>
  )
}
