// Prueba de estres (sin pausas entre solicitudes): busca el maximo de solicitudes por segundo del catalogo.
// Se usa para comparar 1, 2 y 3 instancias del servicio de catalogo (RNF-03). Solo lecturas.
import http from 'k6/http'
import { check } from 'k6'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080'

export const options = {
  scenarios: {
    estres: { executor: 'constant-vus', vus: Number(__ENV.VUS || 100), duration: __ENV.DURACION || '45s' },
  },
}

export function setup() {
  const res = http.get(`${BASE_URL}/api/catalogo?limite=50`)
  return { ids: ((res.json() || {}).items || []).map((p) => p._id).filter(Boolean) }
}

export default function (data) {
  const id = data.ids[Math.floor(Math.random() * data.ids.length)]
  const r = http.batch([
    ['GET', `${BASE_URL}/api/catalogo`, null, { tags: { endpoint: 'listado' } }],
    ['GET', `${BASE_URL}/api/catalogo/${id}`, null, { tags: { endpoint: 'detalle' } }],
  ])
  check(r[0], { 'listado 200': (x) => x.status === 200 })
  check(r[1], { 'detalle 200': (x) => x.status === 200 })
}
