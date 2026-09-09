import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ProductCard } from '../components/ProductCard'
import { catalogoApi, type PaginaCatalogo, type TipoPublicacion } from '../lib/api'
import styles from './Catalogo.module.css'

const CATEGORIAS = ['Electrónica', 'Hogar', 'Moda', 'Servicios profesionales', 'Belleza']

export default function Catalogo() {
  const [params, setParams] = useSearchParams()
  const [pagina, setPagina] = useState<PaginaCatalogo | null>(null)
  const [cargando, setCargando] = useState(true)

  const buscar = params.get('buscar') || ''
  const categoria = params.get('categoria') || ''
  const tipo = (params.get('tipo') as TipoPublicacion | null) || ''
  const precioMin = params.get('precioMin') || ''
  const precioMax = params.get('precioMax') || ''
  const paginaActual = Number(params.get('pagina') || 1)

  const [minInput, setMinInput] = useState(precioMin)
  const [maxInput, setMaxInput] = useState(precioMax)

  useEffect(() => setMinInput(precioMin), [precioMin])
  useEffect(() => setMaxInput(precioMax), [precioMax])

  useEffect(() => {
    setCargando(true)
    catalogoApi
      .listar({
        buscar: buscar || undefined,
        categoria: categoria || undefined,
        tipo: (tipo as TipoPublicacion) || undefined,
        precioMin: precioMin ? Number(precioMin) : undefined,
        precioMax: precioMax ? Number(precioMax) : undefined,
        pagina: paginaActual,
        limite: 9,
      })
      .then(setPagina)
      .finally(() => setCargando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscar, categoria, tipo, precioMin, precioMax, paginaActual])

  const actualizar = (cambios: Record<string, string>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(cambios)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    next.delete('pagina')
    setParams(next)
  }

  const irAPagina = (n: number) => {
    const next = new URLSearchParams(params)
    next.set('pagina', String(n))
    setParams(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="container">
      <h1 style={{ fontSize: '1.375rem', marginBottom: '1.25rem' }}>
        {buscar ? `Resultados para "${buscar}"` : 'Catálogo'}
      </h1>

      <div className={styles.layout}>
        <aside className={`card ${styles.filters}`}>
          <h2 style={{ fontSize: '1.0625rem' }}>Filtros</h2>

          <div className={styles.filterGroup}>
            <h3>Tipo</h3>
            <label className={styles.checkboxRow}>
              <input type="radio" name="tipo" checked={tipo === ''} onChange={() => actualizar({ tipo: '' })} />
              Todos
            </label>
            <label className={styles.checkboxRow}>
              <input type="radio" name="tipo" checked={tipo === 'producto'} onChange={() => actualizar({ tipo: 'producto' })} />
              Productos
            </label>
            <label className={styles.checkboxRow}>
              <input type="radio" name="tipo" checked={tipo === 'servicio'} onChange={() => actualizar({ tipo: 'servicio' })} />
              Servicios
            </label>
          </div>

          <div className={styles.filterGroup}>
            <h3>Categoría</h3>
            <label className={styles.checkboxRow}>
              <input type="radio" name="categoria" checked={categoria === ''} onChange={() => actualizar({ categoria: '' })} />
              Todas
            </label>
            {CATEGORIAS.map((c) => (
              <label key={c} className={styles.checkboxRow}>
                <input type="radio" name="categoria" checked={categoria === c} onChange={() => actualizar({ categoria: c })} />
                {c}
              </label>
            ))}
          </div>

          <div className={styles.filterGroup}>
            <h3>Precio</h3>
            <div className={styles.priceRow}>
              <input
                className="input"
                type="number"
                min={0}
                placeholder="Mín."
                value={minInput}
                onChange={(e) => setMinInput(e.target.value)}
                onBlur={() => actualizar({ precioMin: minInput })}
              />
              <input
                className="input"
                type="number"
                min={0}
                placeholder="Máx."
                value={maxInput}
                onChange={(e) => setMaxInput(e.target.value)}
                onBlur={() => actualizar({ precioMax: maxInput })}
              />
            </div>
          </div>

          <button
            type="button"
            className="btn"
            onClick={() => setParams(new URLSearchParams())}
          >
            Limpiar filtros
          </button>
        </aside>

        <div className={styles.main}>
          {cargando ? (
            <div className="center-loading">
              <div className="spinner" />
            </div>
          ) : !pagina || pagina.items.length === 0 ? (
            <div className="empty-state">No encontramos publicaciones con esos filtros.</div>
          ) : (
            <>
              <div className={styles.topRow}>
                <span className="muted">{pagina.total} resultado{pagina.total === 1 ? '' : 's'}</span>
              </div>

              <div className={styles.grid}>
                {pagina.items.map((p) => (
                  <ProductCard key={p._id} producto={p} />
                ))}
              </div>

              {pagina.totalPaginas > 1 && (
                <div className={styles.pagination}>
                  <button
                    className={styles.pageBtn}
                    disabled={paginaActual <= 1}
                    onClick={() => irAPagina(paginaActual - 1)}
                  >
                    ‹
                  </button>
                  {Array.from({ length: pagina.totalPaginas }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      className={`${styles.pageBtn} ${n === paginaActual ? styles.active : ''}`}
                      onClick={() => irAPagina(n)}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    className={styles.pageBtn}
                    disabled={paginaActual >= pagina.totalPaginas}
                    onClick={() => irAPagina(paginaActual + 1)}
                  >
                    ›
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
