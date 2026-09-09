import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="container empty-state">
      <h2>Página no encontrada</h2>
      <p className="muted" style={{ margin: '0.5rem 0 1.5rem' }}>
        La página que buscas no existe o fue movida.
      </p>
      <Link to="/" className="btn btn-primary">
        Volver al inicio
      </Link>
    </div>
  )
}
