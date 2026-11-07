"""Pruebas de requerimientos no funcionales (Cap. V): RNF-01 (carrito), RNF-02 (caida de Notificaciones) y RNF-06 (consistencia eventual).
Uso (desde proyecto-marketplace/app, con SMTP_HOST vacio en .env para no mandar correos reales): python tests/api/pruebas_rnf.py
Crea cuentas y una publicacion temporales y las borra al terminar."""
import json, subprocess, sys, time, statistics, urllib.request, urllib.error

BASE = "http://localhost:8080/api"
RUN = str(int(time.time()))


def call(method, path, token=None, body=None):
    headers = {"Content-Type": "application/json"} if body is not None else {}
    if token:
        headers["Authorization"] = "Bearer " + token
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode() if body is not None else None, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            txt = r.read().decode()
            return r.status, (json.loads(txt) if txt else None)
    except urllib.error.HTTPError as e:
        txt = e.read().decode()
        try:
            return e.code, json.loads(txt)
        except Exception:
            return e.code, txt


def sh(*args):
    return subprocess.run(args, capture_output=True, text=True)


def psql(q):
    return sh("docker", "compose", "exec", "-T", "postgres", "psql", "-U", "marketplace", "-d", "marketplace", "-tA", "-c", q).stdout.strip()


def cuenta(nombre, vendedor=False):
    email = f"rnf-{nombre}-{RUN}@example.com"
    c, d = call("POST", "/auth/registro", body={"nombre": nombre, "email": email, "password": "Rnf-Prueba-2026"})
    assert c == 201, (c, d)
    psql(f"update usuarios set \"emailVerificado\"=true where email='{email}'")
    if vendedor:
        call("POST", "/auth/me/vendedor", token=d["token"], body={})
        c, d = call("POST", "/auth/login", body={"email": email, "password": "Rnf-Prueba-2026"})
    return email, d["token"], d["usuario"]["id"]


def comprar(tok, producto_id):
    call("DELETE", "/carrito", token=tok)
    c, _ = call("POST", "/carrito/items", token=tok, body={"productoId": producto_id, "cantidad": 1})
    assert c in (200, 201), c
    c, o = call("POST", "/ordenes", token=tok, body={"direccion": {"nombre": "RNF", "telefono": "6000-0000", "direccion": "Calle 1"}})
    assert c == 201, (c, o)
    t0 = time.time()
    c, p = call("POST", f"/pagos/ordenes/{o['id']}", token=tok, body={"metodo": "tarjeta", "numeroTarjeta": "4242424242424242", "vencimiento": "12/35", "cvv": "123"})
    return o["id"], c, p, t0


def esperar(cond, limite=30.0):
    t0 = time.time()
    while time.time() - t0 < limite:
        v = cond()
        if v:
            return time.time() - t0
        time.sleep(0.05)
    return None


resultados = {}
ids_cuentas = []
try:
    _, tokV, idV = cuenta("vendedor", True)
    _, tokC, idC = cuenta("comprador")
    ids_cuentas = [idV, idC]
    img = open("frontend/public/seed/audifonos/1.txt").read().strip()
    c, prod = call("POST", "/catalogo", token=tokV, body={"tipo": "producto", "nombre": "Producto de prueba RNF", "descripcion": "Publicacion temporal para pruebas de requerimientos no funcionales.", "categoria": "Hogar", "precio": 10, "stock": 500, "imagenes": [img]})
    assert c == 201, (c, prod)
    pid = prod["_id"]

    # ---- RNF-01 (carrito): tiempo de respuesta de GET /carrito con un item
    call("DELETE", "/carrito", token=tokC)
    call("POST", "/carrito/items", token=tokC, body={"productoId": pid, "cantidad": 1})
    tiempos = []
    for _ in range(200):
        t = time.time(); call("GET", "/carrito", token=tokC); tiempos.append((time.time() - t) * 1000)
    tiempos.sort()
    resultados["RNF-01 carrito (200 consultas secuenciales, ms)"] = {"media": round(statistics.mean(tiempos), 1), "p95": round(tiempos[int(len(tiempos) * .95) - 1], 1), "max": round(tiempos[-1], 1)}
    call("DELETE", "/carrito", token=tokC)

    # ---- RNF-06: consistencia eventual (pago -> orden pagada -> notificacion), 10 compras con todo arriba
    lag_orden, lag_notif = [], []
    for _ in range(10):
        oid, code, pago, t0 = comprar(tokC, pid)
        assert pago["estado"] == "aprobado", pago
        t_resp = time.time() - t0
        lo = esperar(lambda: call("GET", f"/ordenes/{oid}", token=tokC)[1].get("estadoPago") == "pagada")
        ln = esperar(lambda: any(n.get("ordenId") == oid and n.get("tipo") == "pago_confirmado" for n in call("GET", "/notificaciones", token=tokC)[1]))
        lag_orden.append(round((t_resp + (lo or 0)) * 1000)); lag_notif.append(round((t_resp + (ln or 0)) * 1000))
    resultados["RNF-06 pago -> orden 'pagada' (ms desde que se envia el pago, 10 compras)"] = {"media": round(statistics.mean(lag_orden)), "max": max(lag_orden)}
    resultados["RNF-06 pago -> notificacion al comprador (ms, 10 compras)"] = {"media": round(statistics.mean(lag_notif)), "max": max(lag_notif)}

    # ---- RNF-02: Notificaciones caido, la compra debe completarse
    n_antes = len([n for n in call("GET", "/notificaciones", token=tokC)[1]])
    sh("docker", "compose", "stop", "notificaciones")
    oid, code, pago, _ = comprar(tokC, pid)
    ok_pago = pago.get("estado") == "aprobado"
    ok_orden = esperar(lambda: call("GET", f"/ordenes/{oid}", token=tokC)[1].get("estadoPago") == "pagada", 15) is not None
    ve_vendedor = any(o["id"] == oid for o in call("GET", "/ordenes/vendedor", token=tokV)[1])
    sh("docker", "compose", "start", "notificaciones")
    t0 = time.time()
    recuperada = esperar(lambda: any(n.get("ordenId") == oid for n in call("GET", "/notificaciones", token=tokC)[1]), 60)
    resultados["RNF-02 con Notificaciones apagado"] = {"pago aprobado": ok_pago, "orden queda pagada": ok_orden, "el vendedor ve la orden": ve_vendedor,
                                                      "aviso llega al reiniciar Notificaciones (segundos)": None if recuperada is None else round(recuperada, 1)}
finally:
    sh("docker", "compose", "start", "notificaciones")
    if ids_cuentas:
        lista = ",".join(f"'{i}'" for i in ids_cuentas)
        psql(f"delete from notificaciones where \"usuarioId\"::text in ({lista})")
        psql(f"delete from pagos where \"compradorId\"::text in ({lista})")
        psql(f"delete from ordenes where \"compradorId\"::text in ({lista})")
        psql(f"delete from usuarios where id::text in ({lista})")
    try:
        sh("docker", "compose", "exec", "-T", "mongo", "mongosh", "catalogo", "--quiet", "--eval", 'db.productos.deleteMany({nombre:"Producto de prueba RNF"})')
    except Exception:
        pass
print(json.dumps(resultados, indent=2, ensure_ascii=True))
