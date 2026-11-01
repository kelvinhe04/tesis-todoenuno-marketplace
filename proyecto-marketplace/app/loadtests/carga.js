// Prueba de carga: navegación del catálogo (lectura) + login opcional, con rampa de usuarios virtuales.
// Solo hace lecturas y logins: no crea órdenes ni publicaciones.
//
// Variables (-e NOMBRE=valor):
//   BASE_URL   gateway (por defecto http://localhost:8080)
//   PERFIL     ligera | media | alta  (por defecto media)
//   EMAIL / PASSWORD   cuenta de prueba existente; si faltan, se omite el escenario de login
import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend } from 'k6/metrics'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080'
const EMAIL = __ENV.EMAIL
const PASSWORD = __ENV.PASSWORD

const PERFILES = {
  ligera: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 10 },
    { duration: '10s', target: 0 },
  ],
  media: [
    { duration: '30s', target: 50 },
    { duration: '2m', target: 50 },
    { duration: '10s', target: 0 },
  ],
  alta: [
    { duration: '30s', target: 100 },
    { duration: '1m', target: 200 },
    { duration: '2m', target: 200 },
    { duration: '30s', target: 0 },
  ],
}

export const options = {
  stages: PERFILES[__ENV.PERFIL || 'media'],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800'],
    'http_req_duration{endpoint:listado}': ['p(95)<800'],
    'http_req_duration{endpoint:detalle}': ['p(95)<800'],
  },
}

const tiempoLogin = new Trend('tiempo_login', true)

export function setup() {
  const res = http.get(`${BASE_URL}/api/catalogo?limite=50`)
  // El listado es paginado: { items, total, pagina, limite, totalPaginas }
  const ids = ((res.json() || {}).items || []).map((p) => p._id || p.id).filter(Boolean)
  if (ids.length === 0) throw new Error('El catálogo está vacío: no hay productos que consultar')
  return { ids }
}

export default function (data) {
  const listado = http.get(`${BASE_URL}/api/catalogo`, { tags: { endpoint: 'listado' } })
  check(listado, { 'listado 200': (r) => r.status === 200 })
  sleep(1)

  const id = data.ids[Math.floor(Math.random() * data.ids.length)]
  const detalle = http.get(`${BASE_URL}/api/catalogo/${id}`, { tags: { endpoint: 'detalle' } })
  check(detalle, { 'detalle 200': (r) => r.status === 200 })
  sleep(1)

  if (EMAIL && PASSWORD && Math.random() < 0.2) {
    const login = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({ email: EMAIL, password: PASSWORD }),
      { headers: { 'Content-Type': 'application/json' }, tags: { endpoint: 'login' } },
    )
    tiempoLogin.add(login.timings.duration)
    check(login, { 'login 200/201': (r) => r.status === 200 || r.status === 201 })
    sleep(1)
  }
}
