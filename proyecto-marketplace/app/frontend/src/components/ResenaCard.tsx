import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, resenasApi, type Resena } from '../lib/api'
import { haceCuanto } from '../lib/estado'
import { useAuth } from '../context/AuthContext'
import { Stars } from './Stars'
import { IconThumbUp } from './icons'
import styles from './ResenaCard.module.css'

const COLORES = ['#5b5bd6', '#2f7a4d', '#b5651d', '#a23b72', '#2b7a9b', '#7a5c2e', '#8a4fff', '#c2410c']

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/)
  return ((partes[0]?.[0] ?? '?') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase()
}

function colorDe(nombre: string): string {
  let h = 0
  for (const c of nombre) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return COLORES[h % COLORES.length]
}

export function ResenaCard({ resena, productoId }: { resena: Resena; productoId: string }) {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [utiles, setUtiles] = useState<string[]>(resena.utiles ?? [])
  const [enviando, setEnviando] = useState(false)
  const esPropia = !!usuario && usuario.id === resena.compradorId
  const yoVote = !!usuario && utiles.includes(usuario.id)

  const alternar = async () => {
    if (!usuario) {
      navigate('/login')
      return
    }
    if (esPropia || enviando) return
    setEnviando(true)
    try {
      setUtiles((await resenasApi.alternarUtil(productoId, resena._id)).utiles)
    } catch (err) {
      if (!(err instanceof ApiError)) throw err
    } finally {
      setEnviando(false)
    }
  }

  return (
    <article className={`card ${styles.card}`}>
      <header className={styles.cabecera}>
        <span className={styles.avatar} style={{ background: colorDe(resena.compradorNombre) }} aria-hidden>
          {iniciales(resena.compradorNombre)}
        </span>
        <div className={styles.autor}>
          <p className={styles.nombre}>{resena.compradorNombre}</p>
          <p className={styles.fecha} title={new Date(resena.creadoEn).toLocaleDateString('es-PA')}>
            {haceCuanto(resena.creadoEn)}
          </p>
        </div>
        <Stars valor={resena.calificacion} />
      </header>
      {resena.comentario && <p className={styles.texto}>{resena.comentario}</p>}
      <footer className={styles.pie}>
        <button
          type="button"
          className={`${styles.util} ${yoVote ? styles.utilActivo : ''}`}
          onClick={alternar}
          disabled={esPropia}
          aria-pressed={yoVote}
          title={esPropia ? 'No puedes votar tu propia reseña' : 'Esta reseña me ayudó'}
        >
          <IconThumbUp width={16} height={16} />
          Útil{utiles.length > 0 && ` · ${utiles.length}`}
        </button>
      </footer>
    </article>
  )
}
