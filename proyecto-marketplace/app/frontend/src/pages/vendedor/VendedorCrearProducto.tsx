import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { VendorLayout } from '../../components/VendorLayout'
import { ApiError, catalogoApi, type ModalidadEntrega, type TipoPublicacion } from '../../lib/api'
import { IconImage, IconTrash } from '../../components/icons'
import { MapaLocal } from '../../components/MapaLocal'
import { Select } from '../../components/Select'

const CATEGORIAS_PRODUCTO = ['Electrónica', 'Hogar', 'Moda', 'Belleza']
const CATEGORIAS_SERVICIO = ['Servicios profesionales', 'Belleza']
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DURACIONES = [30, 60, 90, 120]
const MAX_IMAGENES = 4
const MAX_TAMANO_IMAGEN = 2 * 1024 * 1024

function archivoADataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'))
    reader.readAsDataURL(file)
  })
}

export default function VendedorCrearProducto() {
  const { id } = useParams<{ id: string }>()
  const editando = Boolean(id)
  const navigate = useNavigate()

  const [tipo, setTipo] = useState<TipoPublicacion>('producto')
  const [nombre, setNombre] = useState('')
  const [marca, setMarca] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [categoria, setCategoria] = useState(CATEGORIAS_PRODUCTO[0])
  const [precio, setPrecio] = useState('')
  const [stock, setStock] = useState('')
  const [modalidadEntrega, setModalidadEntrega] = useState<ModalidadEntrega>('domicilio_cliente')
  const [direccionLocal, setDireccionLocal] = useState('')
  const [ubicacion, setUbicacion] = useState<{ lat: number; lng: number } | null>(null)
  const [duracionMinutos, setDuracionMinutos] = useState(60)
  const [diasSeleccionados, setDiasSeleccionados] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]))
  const [horaInicio, setHoraInicio] = useState('09:00')
  const [horaFin, setHoraFin] = useState('17:00')
  const [imagenes, setImagenes] = useState<string[]>([])
  const [errorImagenes, setErrorImagenes] = useState<string | null>(null)

  const categoriasDisponibles = tipo === 'producto' ? CATEGORIAS_PRODUCTO : CATEGORIAS_SERVICIO

  const cambiarTipo = (nuevoTipo: TipoPublicacion) => {
    setTipo(nuevoTipo)
    const opciones = nuevoTipo === 'producto' ? CATEGORIAS_PRODUCTO : CATEGORIAS_SERVICIO
    if (!opciones.includes(categoria)) setCategoria(opciones[0])
  }

  const agregarImagenes = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setErrorImagenes(null)
    const espacio = MAX_IMAGENES - imagenes.length
    if (espacio <= 0) {
      setErrorImagenes(`Máximo ${MAX_IMAGENES} imágenes.`)
      return
    }
    const candidatos = Array.from(files).slice(0, espacio)
    const grandes = candidatos.filter((f) => f.size > MAX_TAMANO_IMAGEN)
    if (grandes.length > 0) {
      setErrorImagenes('Cada imagen debe pesar menos de 2 MB.')
    }
    const validos = candidatos.filter((f) => f.size <= MAX_TAMANO_IMAGEN)
    const nuevas = await Promise.all(validos.map(archivoADataUrl))
    setImagenes((prev) => [...prev, ...nuevas])
  }

  const eliminarImagen = (idx: number) => {
    setImagenes((prev) => prev.filter((_, i) => i !== idx))
  }

  const hacerPortada = (idx: number) => {
    setImagenes((prev) => {
      const copia = [...prev]
      const [seleccionada] = copia.splice(idx, 1)
      return [seleccionada, ...copia]
    })
  }

  const alternarDia = (dia: number) => {
    setDiasSeleccionados((prev) => {
      const next = new Set(prev)
      if (next.has(dia)) next.delete(dia)
      else next.add(dia)
      return next
    })
  }

  const [cargando, setCargando] = useState(editando)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    catalogoApi
      .obtener(id)
      .then((p) => {
        setTipo(p.tipo)
        setNombre(p.nombre)
        setMarca(p.marca || '')
        setDescripcion(p.descripcion)
        setCategoria(p.categoria)
        setPrecio(String(p.precio))
        setStock(String(p.stock))
        if (p.modalidadEntrega) setModalidadEntrega(p.modalidadEntrega)
        if (p.direccionLocal) setDireccionLocal(p.direccionLocal)
        if (p.ubicacion) setUbicacion(p.ubicacion)
        if (p.disponibilidad) {
          setDuracionMinutos(p.disponibilidad.duracionMinutos)
          setDiasSeleccionados(new Set(p.disponibilidad.reglas.map((r) => r.diaSemana)))
          if (p.disponibilidad.reglas[0]) {
            setHoraInicio(p.disponibilidad.reglas[0].horaInicio)
            setHoraFin(p.disponibilidad.reglas[0].horaFin)
          }
        }
        if (p.imagenes && p.imagenes.length > 0) setImagenes(p.imagenes)
        else if (p.imagenUrl) setImagenes([p.imagenUrl])
      })
      .catch(() => setError('No se pudo cargar la publicación'))
      .finally(() => setCargando(false))
  }, [id])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (tipo === 'servicio' && modalidadEntrega === 'local_vendedor' && !ubicacion) {
      setError('Marca la ubicación exacta de tu local en el mapa.')
      return
    }
    setGuardando(true)
    try {
      const payload = {
        tipo,
        nombre,
        marca: marca || undefined,
        descripcion,
        categoria,
        precio: Number(precio),
        stock: tipo === 'producto' ? Number(stock || 0) : undefined,
        modalidadEntrega: tipo === 'servicio' ? modalidadEntrega : undefined,
        direccionLocal: tipo === 'servicio' && modalidadEntrega === 'local_vendedor' ? direccionLocal : undefined,
        ubicacion: tipo === 'servicio' && modalidadEntrega === 'local_vendedor' && ubicacion ? ubicacion : undefined,
        disponibilidad:
          tipo === 'servicio' && diasSeleccionados.size > 0
            ? {
                duracionMinutos,
                reglas: Array.from(diasSeleccionados).map((diaSemana) => ({ diaSemana, horaInicio, horaFin })),
              }
            : undefined,
        imagenes: imagenes.length > 0 ? imagenes : undefined,
      }
      if (editando && id) {
        await catalogoApi.actualizar(id, payload)
      } else {
        await catalogoApi.crear(payload)
      }
      navigate('/vendedor/publicaciones')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar la publicación')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <VendorLayout titulo={editando ? 'Editar publicación' : 'Crear publicación'}>
      {cargando ? (
        <div className="center-loading">
          <div className="spinner" />
        </div>
      ) : (
        <form onSubmit={onSubmit} className="card card-pad stack" style={{ maxWidth: '38rem' }}>
          <div
            style={{
              display: 'flex',
              width: 'fit-content',
              border: '1.5px solid var(--color-border-strong)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              onClick={() => cambiarTipo('producto')}
              style={{
                minHeight: '2.5rem',
                minWidth: '7rem',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.875rem',
                cursor: 'pointer',
                background: tipo === 'producto' ? 'var(--color-text)' : 'var(--color-surface)',
                color: tipo === 'producto' ? '#fff' : 'var(--color-text)',
              }}
            >
              Producto
            </button>
            <button
              type="button"
              onClick={() => cambiarTipo('servicio')}
              style={{
                minHeight: '2.5rem',
                minWidth: '7rem',
                border: 'none',
                borderLeft: '1.5px solid var(--color-border-strong)',
                fontWeight: 700,
                fontSize: '0.875rem',
                cursor: 'pointer',
                background: tipo === 'servicio' ? 'var(--color-text)' : 'var(--color-surface)',
                color: tipo === 'servicio' ? '#fff' : 'var(--color-text)',
              }}
            >
              Servicio
            </button>
          </div>

          <div className="field">
            <label htmlFor="nombre">Nombre</label>
            <input id="nombre" className="input" required minLength={3} value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="marca">Marca (opcional)</label>
            <input
              id="marca"
              className="input"
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
              placeholder="Ej. Acer, Logitech, propia..."
            />
          </div>

          <div className="field">
            <label htmlFor="descripcion">Descripción</label>
            <textarea
              id="descripcion"
              className="input"
              required
              minLength={10}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="field">
              <label htmlFor="categoria">Categoría</label>
              <Select
                id="categoria"
                value={categoria}
                onChange={setCategoria}
                options={categoriasDisponibles.map((c) => ({ value: c, label: c }))}
              />
            </div>
            <div className="field">
              <label htmlFor="precio">Precio (USD)</label>
              <input
                id="precio"
                type="number"
                min={0}
                step="0.01"
                className="input"
                required
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
              />
            </div>
          </div>

          {tipo === 'producto' && (
            <div className="field">
              <label htmlFor="stock">Stock disponible</label>
              <input id="stock" type="number" min={0} className="input" value={stock} onChange={(e) => setStock(e.target.value)} />
            </div>
          )}

          {tipo === 'servicio' && (
            <div className="field">
              <label htmlFor="modalidad">Modalidad de entrega</label>
              <Select
                id="modalidad"
                value={modalidadEntrega}
                onChange={(v) => setModalidadEntrega(v as ModalidadEntrega)}
                options={[
                  { value: 'domicilio_cliente', label: 'A domicilio del cliente' },
                  { value: 'local_vendedor', label: 'En el local del vendedor' },
                ]}
              />
              <p className="hint-text">
                Define si te trasladas a la dirección del cliente o el cliente asiste a tu local. Si es a domicilio,
                la dirección se captura en el checkout de la orden.
              </p>
            </div>
          )}

          {tipo === 'servicio' && modalidadEntrega === 'local_vendedor' && (
            <div className="field">
              <label htmlFor="direccionLocal">Dirección del local</label>
              <input
                id="direccionLocal"
                className="input"
                required
                minLength={5}
                value={direccionLocal}
                onChange={(e) => setDireccionLocal(e.target.value)}
                placeholder="Calle, número, referencia, ciudad"
              />
              <p className="hint-text">Se le mostrará al comprador para que sepa a dónde llegar.</p>
            </div>
          )}

          {tipo === 'servicio' && modalidadEntrega === 'local_vendedor' && (
            <div className="field">
              <label>Ubicación exacta del local</label>
              <MapaLocal
                lat={ubicacion?.lat}
                lng={ubicacion?.lng}
                editable
                onChange={(lat, lng) => setUbicacion({ lat, lng })}
              />
              <p className="hint-text">
                {ubicacion
                  ? `Pin colocado (${ubicacion.lat.toFixed(5)}, ${ubicacion.lng.toFixed(5)}). Haz clic en otro punto del mapa para moverlo.`
                  : 'Haz clic en el mapa para marcar la ubicación exacta de tu local.'}
              </p>
            </div>
          )}

          {tipo === 'servicio' && (
            <div className="field">
              <label>Disponibilidad para agendar citas</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div className="field">
                  <label htmlFor="duracion">Duración de la cita</label>
                  <Select
                    id="duracion"
                    value={String(duracionMinutos)}
                    onChange={(v) => setDuracionMinutos(Number(v))}
                    options={DURACIONES.map((d) => ({ value: String(d), label: `${d} min` }))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="horaInicio">Hora inicio</label>
                  <input
                    id="horaInicio"
                    type="time"
                    className="input"
                    value={horaInicio}
                    onChange={(e) => setHoraInicio(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="horaFin">Hora fin</label>
                  <input id="horaFin" type="time" className="input" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                {DIAS.map((nombreDia, dia) => (
                  <button
                    type="button"
                    key={dia}
                    onClick={() => alternarDia(dia)}
                    style={{
                      minWidth: '2.75rem',
                      minHeight: '2.25rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1.5px solid var(--color-border-strong)',
                      fontWeight: 700,
                      fontSize: '0.8125rem',
                      cursor: 'pointer',
                      background: diasSeleccionados.has(dia) ? 'var(--color-text)' : 'var(--color-surface)',
                      color: diasSeleccionados.has(dia) ? '#fff' : 'var(--color-text)',
                    }}
                  >
                    {nombreDia}
                  </button>
                ))}
              </div>
              <p className="hint-text">
                Los compradores solo podrán reservar horarios dentro de estos días y ese rango de horas.
              </p>
            </div>
          )}

          <div className="field">
            <label>Fotos (hasta {MAX_IMAGENES})</label>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {imagenes.map((img, idx) => (
                <div
                  key={idx}
                  style={{
                    position: 'relative',
                    width: '6rem',
                    height: '6rem',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    border: idx === 0 ? '2px solid var(--color-accent)' : '1.5px solid var(--color-border-strong)',
                    background: tipo === 'producto' ? '#fff' : 'var(--color-accent-soft)',
                  }}
                >
                  <img
                    src={img}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: tipo === 'producto' ? 'contain' : 'cover' }}
                  />
                  {idx === 0 ? (
                    <span
                      className="badge badge-neutral"
                      style={{ position: 'absolute', top: 4, left: 4, fontSize: '0.625rem' }}
                    >
                      Portada
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => hacerPortada(idx)}
                      style={{
                        position: 'absolute',
                        top: 4,
                        left: 4,
                        fontSize: '0.625rem',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.15rem 0.4rem',
                        cursor: 'pointer',
                        background: 'rgba(255,255,255,0.9)',
                      }}
                    >
                      Hacer portada
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => eliminarImagen(idx)}
                    aria-label="Eliminar imagen"
                    style={{
                      position: 'absolute',
                      bottom: 4,
                      right: 4,
                      width: '1.5rem',
                      height: '1.5rem',
                      borderRadius: '50%',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      background: 'rgba(255,255,255,0.9)',
                      color: 'var(--color-danger)',
                    }}
                  >
                    <IconTrash width={14} height={14} />
                  </button>
                </div>
              ))}
              {imagenes.length < MAX_IMAGENES && (
                <label
                  htmlFor="imagenesInput"
                  style={{
                    width: '6rem',
                    height: '6rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1.5px dashed var(--color-border-strong)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'var(--color-accent)',
                  }}
                >
                  <IconImage width={24} height={24} />
                  <input
                    id="imagenesInput"
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      agregarImagenes(e.target.files)
                      e.target.value = ''
                    }}
                  />
                </label>
              )}
            </div>
            <p className="hint-text">La primera foto (marcada como Portada) es la que se ve en el catálogo.</p>
            {errorImagenes && <p className="error-text">{errorImagenes}</p>}
          </div>

          {error && <p className="error-text">{error}</p>}

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="submit" className="btn btn-primary" disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
            <button type="button" className="btn" onClick={() => navigate(-1)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </VendorLayout>
  )
}
