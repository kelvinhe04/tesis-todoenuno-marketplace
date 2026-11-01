// Prueba de humo: 1 usuario virtual verifica que el gateway y los 6 servicios responden.
import http from 'k6/http'
import { check } from 'k6'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080'
const SERVICIOS = ['auth', 'catalogo', 'carrito', 'ordenes', 'pagos', 'notificaciones']

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: { checks: ['rate==1'] },
}

export default function () {
  for (const s of SERVICIOS) {
    const res = http.get(`${BASE_URL}/api/${s}/health`)
    check(res, { [`${s} responde 200`]: (r) => r.status === 200 })
  }
}
