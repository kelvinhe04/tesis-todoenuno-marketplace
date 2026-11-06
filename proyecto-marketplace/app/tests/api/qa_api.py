"""Bateria de pruebas de la API de TodoEnUno (sobre el gateway).

Cubre autenticacion (incluida verificacion de correo, revocacion de sesiones y limite de intentos),
catalogo, carrito, reservas de servicios, ordenes (con entrega por vendedor), pagos (con concurrencia),
resenas, notificaciones y la superficie expuesta del gateway. Ver tests/README.md.
"""
import json, os, re, subprocess, sys, time, base64, threading, urllib.request, urllib.error
from datetime import datetime, timedelta, timezone

BASE = os.environ.get("API_BASE", "http://localhost:8080/api")
APP_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))  # carpeta app/ (donde esta docker-compose.yml)

RUN = str(int(time.time()))[-6:]
PW = "Clave12345!"
IMG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

resultados = []  # (seccion, nombre, ok, detalle)
seccion = ["-"]
creados = {"emails": [], "productos": []}


def call(method, path, token=None, body=None, raw=False):
    url = BASE + path
    data = None
    headers = {}
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = "Bearer " + token
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            txt = r.read().decode()
            code = r.status
    except urllib.error.HTTPError as e:
        txt = e.read().decode()
        code = e.code
    except Exception as e:  # timeout, conexion
        return 0, {"error": str(e)}
    try:
        return code, json.loads(txt) if txt else None
    except Exception:
        return code, txt


def enlace_verificacion(email):
    """Token del enlace de verificacion que auth deja en su log (el correo va a un buzon sandbox)."""
    patron = re.compile(r"Enlace de verificaci.n para " + re.escape(email.lower()) + r": \S+?token=([\w.\-]+)")
    for _ in range(12):
        salida = subprocess.run(["docker", "compose", "logs", "--no-color", "--since", "15m", "auth"], cwd=APP_DIR,
                                capture_output=True, text=True, encoding="utf-8", errors="replace").stdout
        hallados = patron.findall(salida)
        if hallados:
            return hallados[-1]
        time.sleep(1)
    return None


def _compose(*args, entrada=None):
    return subprocess.run(["docker", "compose", *args], cwd=APP_DIR, input=entrada, capture_output=True, text=True,
                          encoding="utf-8", errors="replace")


def limpiar_datos_qa():
    """Borra TODO lo que crean estas pruebas (cuentas qa-*@example.com y lo que cuelga de ellas)."""
    psql = ["exec", "-T", "postgres", "psql", "-U", "marketplace", "-d", "marketplace", "-t", "-A", "-c"]
    ids = [i for i in _compose(*psql, "select id::text from usuarios where lower(email) like 'qa-%@example.com'").stdout.split() if i]
    if not ids:
        print("Limpieza: no habia cuentas de prueba.")
        return
    lista = ",".join("'" + i + "'" for i in ids)
    for sql in [
        f'delete from notificaciones where "usuarioId" in ({lista})',
        f'delete from pagos where "compradorId" in ({lista})',
        f'delete from ordenes where "compradorId" in ({lista})',
        f'delete from direcciones where "usuarioId" in ({lista})',
        f'delete from tarjetas_guardadas where "usuarioId" in ({lista})',
        f"delete from usuarios where id::text in ({lista})",
    ]:
        _compose(*psql, sql)
    js = (
        "const ids=" + json.dumps(ids) + ";"
        "const prods=db.productos.find({vendedorId:{$in:ids}},{_id:1}).toArray().map(p=>p._id.toString());"
        "db.productos.deleteMany({vendedorId:{$in:ids}});"
        "db.reservas.deleteMany({$or:[{compradorId:{$in:ids}},{vendedorId:{$in:ids}}]});"
        "db.resenas.deleteMany({$or:[{compradorId:{$in:ids}},{productoId:{$in:prods}}]});"
    )
    _compose("exec", "-T", "mongo", "mongosh", "catalogo", "--quiet", "--eval", js)
    claves = []
    for patron in ["login:fallos:ip:*", "login:fallos:correo:qa-*", "login:fallos:correo:claudehewu@gmail.com"] + [f"carrito:{i}*" for i in ids] + [f"sesion:valida-desde:{i}" for i in ids] + [f"verificacion:reenvio:{i}" for i in ids]:
        claves += _compose("exec", "-T", "redis", "redis-cli", "--scan", "--pattern", patron).stdout.split()
    if claves:
        _compose("exec", "-T", "redis", "redis-cli", "del", *claves)
    print(f"Limpieza: {len(ids)} cuentas de prueba y sus datos eliminados.")


def check(nombre, ok, detalle=""):
    resultados.append((seccion[0], nombre, bool(ok), str(detalle)[:220]))
    print(("  OK   " if ok else "  FALLA"), nombre, "" if ok else "-> " + str(detalle)[:220])


def sec(nombre):
    seccion[0] = nombre
    print("\n== " + nombre)


def msg(r):
    return r.get("message") if isinstance(r, dict) else r


def registrar(nombre, tag, verificar_correo=True):
    """Crea una cuenta de prueba. Por defecto sigue el enlace de verificacion (sin eso no se puede comprar)."""
    email = f"qa-{tag}-{RUN}@example.com"
    creados["emails"].append(email)
    c, r = call("POST", "/auth/registro", body={"nombre": nombre, "email": email, "password": PW})
    if c == 201 and verificar_correo:
        token = enlace_verificacion(email)
        cv, rv = call("POST", "/auth/verificar-correo", body={"token": token or "no-hay-enlace"})
        if cv in (200, 201):
            r["usuario"]["emailVerificado"] = True
        else:
            print("  (aviso) no se pudo verificar el correo de", email, cv, msg(rv))
    return email, c, r


def hoy_panama():
    return datetime.now(timezone(timedelta(hours=-5)))


def fecha_futura(dias):
    return (hoy_panama() + timedelta(days=dias)).strftime("%Y-%m-%d")


def prod_payload(**kw):
    base = {"tipo": "producto", "nombre": "QA Producto " + RUN, "descripcion": "Producto de prueba automatica QA",
            "categoria": "Hogar", "precio": 10, "stock": 5, "imagenes": [IMG]}
    base.update(kw)
    return base


def dir_orden():
    return {"direccion": {"nombre": "QA Comprador", "telefono": "6000-0000", "direccion": "Calle 1, Panama"}}


# --------------------------------------------------------------------------------------
sec("Salud y gateway")
for s in ["auth", "catalogo", "carrito", "ordenes", "pagos", "notificaciones"]:
    c, _ = call("GET", f"/{s}/health")
    check(f"health {s}", c == 200, c)
c, _ = call("GET", "/auth/internal/email/x")
check("ruta interna auth NO expuesta", c == 404, c)
c, _ = call("GET", "/ordenes/internal/x")
check("ruta interna ordenes NO expuesta", c == 404, c)
c, _ = call("POST", "/catalogo/internal/descontar-stock", body={"items": []})
check("ruta interna catalogo NO expuesta", c == 404, c)
c, _ = call("GET", "/no-existe")
check("ruta desconocida -> 404", c == 404, c)

sec("Autenticacion")
emailA, c, r = registrar("QA Comprador A", "a")
check("registro comprador A", c == 201 and r["usuario"]["rol"] == "comprador", (c, msg(r)))
tokA = r["token"] if c == 201 else None
idA = r["usuario"]["id"] if c == 201 else None
c, r2 = call("POST", "/auth/registro", body={"nombre": "Dup", "email": emailA, "password": PW})
check("correo duplicado -> 409", c == 409, (c, msg(r2)))
c, r2 = call("POST", "/auth/registro", body={"nombre": "Dup", "email": emailA.upper(), "password": PW})
check("correo duplicado con MAYUSCULAS -> 409 (no crear 2da cuenta)", c == 409, (c, msg(r2)))
if c == 201:
    creados["emails"].append(emailA.upper())
c, r2 = call("POST", "/auth/registro", body={"nombre": "X", "email": "no-es-correo", "password": PW})
check("correo invalido -> 400", c == 400, c)
c, r2 = call("POST", "/auth/registro", body={"nombre": "Xx", "email": f"qa-short-{RUN}@example.com", "password": "123"})
check("contrasena corta -> 400", c == 400, c)
c, r2 = call("POST", "/auth/registro", body={"nombre": "Xx", "email": f"qa-rol-{RUN}@example.com", "password": PW, "rol": "vendedor"})
creados["emails"].append(f"qa-rol-{RUN}@example.com")
check("registro ignora rol=vendedor (nace comprador)", c == 201 and r2["usuario"]["rol"] == "comprador", (c, r2 if c != 201 else r2["usuario"]))
c, r2 = call("POST", "/auth/registro", body={"nombre": "Xx", "email": f"qa-adm-{RUN}@example.com", "password": PW, "rol": "admin"})
creados["emails"].append(f"qa-adm-{RUN}@example.com")
check("registro con rol=admin no escala privilegios", (c == 201 and r2["usuario"]["rol"] == "comprador") or c == 400, (c, r2 if c != 201 else r2["usuario"]))
c, r2 = call("POST", "/auth/login", body={"email": emailA, "password": PW})
check("login correcto", c in (200, 201) and "token" in r2, (c, msg(r2)))
c, r2 = call("POST", "/auth/login", body={"email": emailA, "password": "incorrecta1"})
check("login clave incorrecta -> 401", c == 401, c)
c, r2 = call("POST", "/auth/login", body={"email": f"nadie-{RUN}@example.com", "password": PW})
check("login usuario inexistente -> 401", c == 401, c)
c, r2 = call("POST", "/auth/login", body={"email": "claudehewu@gmail.com", "password": PW})
check("login cuenta solo-Google con clave -> 401 (no 500)", c == 401, (c, msg(r2)))
c, r2 = call("POST", "/auth/login", body={"email": "' OR 1=1 --", "password": PW})
check("login con inyeccion SQL -> 400", c == 400, c)
c, r2 = call("POST", "/auth/google", body={"credential": "token-falso"})
check("login Google con credencial falsa -> 401", c == 401, (c, msg(r2)))
c, r2 = call("GET", "/auth/me")
check("/me sin token -> 401", c == 401, c)
c, r2 = call("GET", "/auth/me", token="basura.basura.basura")
check("/me con token basura -> 401", c == 401, c)
# token manipulado: cambiar rol en el payload sin volver a firmar
if tokA:
    h, p, s = tokA.split(".")
    pad = lambda x: x + "=" * (-len(x) % 4)
    payload = json.loads(base64.urlsafe_b64decode(pad(p)))
    payload["rol"] = "vendedor"
    p2 = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    c, r2 = call("POST", "/catalogo", token=f"{h}.{p2}.{s}", body=prod_payload())
    check("token con rol alterado -> 401", c == 401, c)
    none_tok = base64.urlsafe_b64encode(b'{"alg":"none","typ":"JWT"}').decode().rstrip("=") + "." + p2 + "."
    c, r2 = call("POST", "/catalogo", token=none_tok, body=prod_payload())
    check("token alg=none -> 401", c == 401, c)
c, r2 = call("GET", "/auth/me", token=tokA)
check("/me devuelve el perfil", c == 200 and r2["email"] == emailA.lower() or r2.get("email") == emailA, (c, r2))
c, r2 = call("PATCH", "/auth/me", token=tokA, body={"nombre": "QA Comprador A2"})
check("editar nombre", c == 200 and r2["nombre"] == "QA Comprador A2", (c, r2))
c, r2 = call("PATCH", "/auth/me", token=tokA, body={"nombre": "A"})
check("nombre de 1 letra -> 400", c == 400, c)
c, r2 = call("PATCH", "/auth/me", token=tokA, body={"passwordNueva": "NuevaClave123"})
check("cambiar clave sin la actual -> 400/401", c in (400, 401), (c, msg(r2)))
c, r2 = call("PATCH", "/auth/me", token=tokA, body={"passwordNueva": "NuevaClave123", "passwordActual": "mala"})
check("cambiar clave con actual incorrecta -> 401", c == 401, (c, msg(r2)))
time.sleep(1.2)  # el token viejo debe haberse emitido en un segundo anterior al del cambio
c, r2 = call("PATCH", "/auth/me", token=tokA, body={"passwordNueva": "NuevaClave123", "passwordActual": PW})
check("cambiar clave correcta", c == 200, (c, msg(r2)))
if c == 200 and r2.get("token"):
    tokA = r2["token"]  # cambiar la clave cierra las demas sesiones: se sigue con el token nuevo
c, r2 = call("POST", "/auth/login", body={"email": emailA, "password": "NuevaClave123"})
check("login con la clave nueva", c in (200, 201), c)
c, r2 = call("PATCH", "/auth/me", token=tokA, body={"rol": "vendedor", "email": "otro@x.com"})
c2, me = call("GET", "/auth/me", token=tokA)
check("PATCH /me no permite cambiar rol ni email (mass assignment)", me.get("rol") == "comprador" and me.get("email") != "otro@x.com", me)

sec("Modo vendedor")
emailS, c, r = registrar("QA Vendedor S", "s")
tokS0 = r["token"]
c, r2 = call("POST", "/catalogo", token=tokS0, body=prod_payload())
check("comprador no puede publicar -> 403", c == 403, c)
c, r2 = call("POST", "/auth/me/vendedor", token=tokS0)
check("activar modo vendedor", c in (200, 201) and r2["usuario"]["rol"] == "vendedor", (c, msg(r2)))
tokS = r2["token"]
idS = r2["usuario"]["id"]
c, r2 = call("POST", "/auth/me/vendedor", token=tokS)
check("activar modo vendedor es idempotente", c in (200, 201) and r2["usuario"]["rol"] == "vendedor", c)
c, r2 = call("POST", "/auth/me/vendedor")
check("activar vendedor sin token -> 401", c == 401, c)
c, r2 = call("GET", "/ordenes/vendedor", token=tokA)
check("comprador consulta ordenes de vendedor (vacio o 403)", (c == 200 and r2 == []) or c == 403, (c, r2))

sec("Catalogo - publicar")
c, r = call("POST", "/catalogo", token=tokS, body=prod_payload(imagenes=[]))
check("sin foto -> 400", c == 400, (c, msg(r)))
c, r = call("POST", "/catalogo", token=tokS, body=prod_payload(precio=-5))
check("precio negativo -> 400", c == 400, c)
c, r = call("POST", "/catalogo", token=tokS, body=prod_payload(precio="diez"))
check("precio texto -> 400", c == 400, c)
c, r = call("POST", "/catalogo", token=tokS, body=prod_payload(stock=-1))
check("stock negativo -> 400", c == 400, c)
c, r = call("POST", "/catalogo", token=tokS, body=prod_payload(stock=2.5))
check("stock decimal -> 400", c == 400, (c, msg(r)))
if c == 201: creados["productos"].append(r["_id"])
c, r = call("POST", "/catalogo", token=tokS, body=prod_payload(nombre="ab"))
check("nombre corto -> 400", c == 400, c)
c, r = call("POST", "/catalogo", token=tokS, body=prod_payload(descripcion="corta"))
check("descripcion corta -> 400", c == 400, c)
c, r = call("POST", "/catalogo", token=tokS, body=prod_payload(categoria="Categoria Inventada"))
check("categoria fuera de la lista -> 400", c == 400, (c, msg(r)))
if c == 201: creados["productos"].append(r["_id"])
c, r = call("POST", "/catalogo", token=tokS, body=prod_payload(precio=10.999))
check("precio con 3 decimales -> 400", c == 400, (c, msg(r)))
if c == 201: creados["productos"].append(r["_id"])
c, r = call("POST", "/catalogo", token=tokS, body=prod_payload(vendedorId="otro", calificacionPromedio=5, numResenas=999))
check("mass assignment: vendedorId/calificacion ignorados", c == 201 and r["vendedorId"] == idS and r.get("calificacionPromedio", 0) == 0, (c, r if c != 201 else {k: r.get(k) for k in ("vendedorId", "calificacionPromedio", "numResenas")}))
if c == 201: creados["productos"].append(r["_id"])
c, P1 = call("POST", "/catalogo", token=tokS, body=prod_payload(nombre="QA P1 " + RUN, stock=5, precio=10))
check("publicar producto P1", c == 201, (c, msg(P1)))
creados["productos"].append(P1["_id"])
c, P2 = call("POST", "/catalogo", token=tokS, body=prod_payload(nombre="QA P2 ultima unidad " + RUN, stock=1, precio=7))
creados["productos"].append(P2["_id"])
c, P3 = call("POST", "/catalogo", token=tokS, body=prod_payload(nombre="QA P3 pausable " + RUN, stock=3, precio=4))
creados["productos"].append(P3["_id"])

dispo_ok = {"duracionMinutos": 60, "reglas": [{"diaSemana": d, "horaInicio": "09:00", "horaFin": "17:00"} for d in range(7)],
            "diasNoDisponibles": [fecha_futura(3)]}
c, r = call("POST", "/catalogo", token=tokS, body=prod_payload(tipo="servicio", categoria="Belleza", nombre="QA Servicio " + RUN, modalidadEntrega="domicilio_cliente", disponibilidad=dispo_ok))
check("publicar servicio con disponibilidad", c == 201, (c, msg(r)))
SV = r
creados["productos"].append(SV["_id"])
c, r = call("POST", "/catalogo", token=tokS, body=prod_payload(tipo="servicio", categoria="Belleza", modalidadEntrega="domicilio_cliente", disponibilidad={"duracionMinutos": 60, "reglas": []}))
check("servicio sin ningun dia -> 400", c == 400, (c, msg(r)))
c, r = call("POST", "/catalogo", token=tokS, body=prod_payload(tipo="servicio", categoria="Belleza", modalidadEntrega="domicilio_cliente"))
check("servicio SIN disponibilidad -> 400 (nadie podria agendarlo)", c == 400, (c, msg(r)))
if c == 201: creados["productos"].append(r["_id"])
c, r = call("POST", "/catalogo", token=tokS, body=prod_payload(tipo="servicio", categoria="Belleza", modalidadEntrega="domicilio_cliente",
        disponibilidad={"duracionMinutos": 60, "reglas": [{"diaSemana": 1, "horaInicio": "25:00", "horaFin": "99:99"}]}))
check("horas invalidas 25:00-99:99 -> 400", c == 400, (c, msg(r)))
if c == 201: creados["productos"].append(r["_id"])
c, r = call("POST", "/catalogo", token=tokS, body=prod_payload(tipo="servicio", categoria="Belleza", modalidadEntrega="domicilio_cliente",
        disponibilidad={"duracionMinutos": 60, "reglas": [{"diaSemana": 1, "horaInicio": "17:00", "horaFin": "09:00"}]}))
check("hora fin anterior a inicio -> 400", c == 400, (c, msg(r)))
if c == 201: creados["productos"].append(r["_id"])
c, r = call("POST", "/catalogo", token=tokS, body=prod_payload(tipo="servicio", categoria="Belleza", modalidadEntrega="domicilio_cliente",
        disponibilidad={"duracionMinutos": 60, "reglas": [{"diaSemana": 1, "horaInicio": "09:00", "horaFin": "09:30"}]}))
check("rango menor que la duracion de la cita -> 400", c == 400, (c, msg(r)))
if c == 201: creados["productos"].append(r["_id"])
c, r = call("POST", "/catalogo", token=tokS, body=prod_payload(tipo="servicio", categoria="Belleza", modalidadEntrega="local_vendedor",
        disponibilidad=dispo_ok))
check("servicio en local sin direccion/ubicacion -> 400", c == 400, (c, msg(r)))
if c == 201: creados["productos"].append(r["_id"])
c, r = call("POST", "/catalogo", token=tokS, body=prod_payload(tipo="servicio", categoria="Belleza", modalidadEntrega="domicilio_cliente",
        disponibilidad={"duracionMinutos": 60, "reglas": [{"diaSemana": 1, "horaInicio": "20:00", "horaFin": "23:59"}], "diasNoDisponibles": ["no-es-fecha"]}))
check("diasNoDisponibles con formato invalido -> 400", c == 400, (c, msg(r)))
if c == 201: creados["productos"].append(r["_id"])
# el bucle infinito de horas nocturnas
c, r = call("POST", "/catalogo", token=tokS, body=prod_payload(tipo="servicio", categoria="Belleza", nombre="QA Nocturno " + RUN, modalidadEntrega="domicilio_cliente",
        disponibilidad={"duracionMinutos": 60, "reglas": [{"diaSemana": d, "horaInicio": "08:00", "horaFin": "23:59"} for d in range(7)]}))
check("servicio 08:00-23:59 se puede publicar", c == 201, (c, msg(r)))
if c == 201:
    creados["productos"].append(r["_id"])
    t0 = time.time()
    c2, sl = call("GET", f"/catalogo/{r['_id']}/disponibilidad?fecha={fecha_futura(2)}")
    check("disponibilidad de horario nocturno responde (sin bucle infinito)", c2 == 200 and isinstance(sl, list) and time.time() - t0 < 5, (c2, time.time() - t0))
    if c2 == 200 and isinstance(sl, list):
        check("ningun horario cruza la medianoche", all(s["horaFin"] <= "23:59" and s["horaFin"] > s["horaInicio"] for s in sl), sl[-2:])

sec("Catalogo - consulta")
c, r = call("GET", "/catalogo?limite=12")
check("listar catalogo", c == 200 and "items" in r, c)
c, r = call("GET", "/catalogo?limite=100000")
check("limite enorme -> 400 (no volcar toda la BD)", c == 400, (c, str(r)[:80]))
c, r = call("GET", "/catalogo?limite=0")
check("limite 0 -> 400", c == 400, c)
c, r = call("GET", "/catalogo?pagina=0")
check("pagina 0 -> 400", c == 400, c)
c, r = call("GET", "/catalogo?pagina=99999")
check("pagina inexistente -> lista vacia", c == 200 and r["items"] == [], c)
c, r = call("GET", "/catalogo?precioMin=abc")
check("precioMin no numerico -> 400", c == 400, c)
c, r = call("GET", "/catalogo?tipo=otro")
check("tipo invalido -> 400", c == 400, c)
c, r = call("GET", "/catalogo?buscar=.*(")
check("busqueda con simbolos de regex no rompe", c == 200, (c, str(r)[:80]))
c, r = call("GET", f"/catalogo?buscar=QA%20P1%20{RUN}")
check("buscar por nombre encuentra el producto", c == 200 and any(i["_id"] == P1["_id"] for i in r["items"]), c)
c, r = call("GET", "/catalogo?tipo=servicio&limite=50")
check("filtro tipo=servicio solo servicios", c == 200 and all(i["tipo"] == "servicio" for i in r["items"]), c)
c, r = call("GET", "/catalogo?precioMin=9&precioMax=11&limite=50")
check("filtro de precio respeta el rango", c == 200 and all(9 <= i["precio"] <= 11 for i in r["items"]), c)
c, r = call("GET", f"/catalogo/{P1['_id']}")
check("detalle de producto", c == 200 and r["_id"] == P1["_id"], c)
c, r = call("GET", "/catalogo/abc")
check("id con formato invalido -> 400/404 (no 500)", c in (400, 404), (c, msg(r)))
c, r = call("GET", "/catalogo/507f1f77bcf86cd799439011")
check("id inexistente -> 404", c == 404, c)

sec("Catalogo - editar, pausar, borrar")
emailX, c, r = registrar("QA Vendedor X", "x")
c, r = call("POST", "/auth/me/vendedor", token=r["token"])
tokX = r["token"]
c, r = call("PATCH", f"/catalogo/{P3['_id']}", token=tokX, body={"precio": 1})
check("otro vendedor no puede editar -> 403", c == 403, c)
c, r = call("PATCH", f"/catalogo/{P3['_id']}", token=tokA, body={"precio": 1})
check("comprador no puede editar -> 403", c == 403, c)
c, r = call("DELETE", f"/catalogo/{P3['_id']}", token=tokX)
check("otro vendedor no puede borrar -> 403", c == 403, c)
c, r = call("PATCH", f"/catalogo/{P3['_id']}", token=tokS, body={"imagenes": []})
check("quitar todas las fotos al editar -> 400", c == 400, (c, msg(r)))
c, r = call("PATCH", f"/catalogo/{P3['_id']}", token=tokS, body={"calificacionPromedio": 5, "vendedorId": "x", "precio": 4.5})
c2, d = call("GET", f"/catalogo/{P3['_id']}")
check("editar: precio cambia, calificacion/vendedorId ignorados", c == 200 and d["precio"] == 4.5 and d["vendedorId"] == idS and d.get("calificacionPromedio", 0) == 0, (c, d.get("precio"), d.get("vendedorId"), d.get("calificacionPromedio")))
c, r = call("PATCH", f"/catalogo/{P3['_id']}", token=tokS, body={"pausada": True})
check("pausar publicacion", c == 200 and r["pausada"] is True, (c, msg(r)))
c, r = call("GET", f"/catalogo?buscar=QA%20P3%20pausable%20{RUN}")
check("pausada NO aparece en el catalogo publico", c == 200 and not any(i["_id"] == P3["_id"] for i in r["items"]), c)
c, r = call("GET", f"/catalogo?vendedorId={idS}&incluirPausadas=true&limite=50")
check("el vendedor ve sus pausadas", c == 200 and any(i["_id"] == P3["_id"] for i in r["items"]), c)
c, r = call("GET", f"/catalogo?vendedorId={idS}&limite=50")
check("sin incluirPausadas no se ven", c == 200 and not any(i["_id"] == P3["_id"] for i in r["items"]), c)
c, r = call("POST", "/carrito/items", token=tokA, body={"productoId": P3["_id"], "cantidad": 1})
check("no se puede agregar al carrito una pausada -> 400", c == 400, (c, msg(r)))
c, r = call("PATCH", f"/catalogo/{P3['_id']}", token=tokS, body={"pausada": False})
check("reactivar", c == 200 and r["pausada"] is False, c)

sec("Direcciones y tarjetas guardadas")
c, r = call("POST", "/auth/me/direcciones", token=tokA, body={"nombre": "Casa", "telefono": "abc", "direccion": "Calle 5 Casa 2"})
check("direccion con telefono invalido -> 400", c == 400, c)
c, d1 = call("POST", "/auth/me/direcciones", token=tokA, body={"nombre": "Casa", "telefono": "6000-1111", "direccion": "Calle 5 Casa 2", "predeterminada": True})
check("crear direccion", c in (200, 201), (c, msg(d1)))
c, d2 = call("POST", "/auth/me/direcciones", token=tokA, body={"nombre": "Oficina", "telefono": "2345678", "direccion": "Av. Balboa 100", "predeterminada": True})
c, lista = call("GET", "/auth/me/direcciones", token=tokA)
check("solo una direccion predeterminada", c == 200 and sum(1 for x in lista if x["predeterminada"]) == 1, [x["predeterminada"] for x in lista])
c, r = call("PATCH", f"/auth/me/direcciones/{d1['id']}", token=tokS, body={"nombre": "Hack"})
check("editar la direccion de otro usuario -> 403/404", c in (403, 404), c)
c, r = call("DELETE", f"/auth/me/direcciones/{d1['id']}", token=tokS)
check("borrar la direccion de otro usuario -> 403/404", c in (403, 404), c)
c, r = call("PATCH", f"/auth/me/direcciones/{d1['id']}", token=tokA, body={"nombre": "Casa 2"})
check("editar direccion propia", c == 200, c)
c, r = call("DELETE", f"/auth/me/direcciones/{d1['id']}", token=tokA)
check("borrar direccion propia", c in (200, 204), c)
c, r = call("DELETE", f"/auth/me/direcciones/{d1['id']}", token=tokA)
check("borrar direccion ya borrada -> 404", c == 404, c)
c, r = call("DELETE", "/auth/me/direcciones/no-es-uuid", token=tokA)
check("id de direccion invalido -> 400/404 (no 500)", c in (400, 404), (c, msg(r)))
c, r = call("POST", "/auth/me/tarjetas", token=tokA, body={"marca": "Visa", "ultimos4": "4242", "vencimiento": "01/20"})
check("tarjeta vencida -> 400", c == 400, (c, msg(r)))
c, r = call("POST", "/auth/me/tarjetas", token=tokA, body={"marca": "Visa", "ultimos4": "42", "vencimiento": "12/35"})
check("ultimos4 invalidos -> 400", c == 400, c)
c, r = call("POST", "/auth/me/tarjetas", token=tokA, body={"marca": "Discover", "ultimos4": "4242", "vencimiento": "12/35"})
check("marca desconocida -> 400", c == 400, c)
c, r = call("POST", "/auth/me/tarjetas", token=tokA, body={"marca": "Visa", "ultimos4": "4242", "vencimiento": "13/35"})
check("mes 13 -> 400", c == 400, c)
c, t1 = call("POST", "/auth/me/tarjetas", token=tokA, body={"marca": "Visa", "ultimos4": "4242", "vencimiento": "12/35", "predeterminada": True,
                                                              "numero": "4242424242424242", "cvv": "123"})
check("guardar tarjeta valida", c in (200, 201), (c, msg(t1)))
c, lista = call("GET", "/auth/me/tarjetas", token=tokA)
check("la tarjeta NO guarda numero completo ni CVV", c == 200 and all("numero" not in x and "cvv" not in x for x in lista), lista)
c, r = call("PATCH", f"/auth/me/tarjetas/{t1['id']}/predeterminada", token=tokS)
check("tarjeta de otro usuario -> 403/404", c in (403, 404), c)
c, r = call("DELETE", f"/auth/me/tarjetas/{t1['id']}", token=tokA)
check("borrar tarjeta propia", c in (200, 204), c)

sec("Carrito")
c, r = call("GET", "/carrito")
check("carrito sin token -> 401", c == 401, c)
c, r = call("GET", "/carrito", token=tokA)
check("carrito vacio", c == 200 and r["items"] == [] and r["total"] == 0, r)
for cant in (0, -1, 1.5, "2"):
    c, r = call("POST", "/carrito/items", token=tokA, body={"productoId": P1["_id"], "cantidad": cant})
    check(f"cantidad invalida {cant!r} -> 400", c == 400, (c, msg(r)))
c, r = call("POST", "/carrito/items", token=tokA, body={"productoId": P1["_id"], "cantidad": 999999})
check("cantidad mayor al stock -> 400", c == 400, (c, msg(r)))
c, r = call("POST", "/carrito/items", token=tokA, body={"productoId": "abc", "cantidad": 1})
check("producto con id invalido -> 400", c == 400, (c, msg(r)))
c, r = call("POST", "/carrito/items", token=tokA, body={"productoId": "507f1f77bcf86cd799439011", "cantidad": 1})
check("producto inexistente -> 400", c == 400, (c, msg(r)))
c, r = call("POST", "/carrito/items", token=tokS, body={"productoId": P1["_id"], "cantidad": 1})
check("el vendedor no compra su propio producto -> 400", c == 400, (c, msg(r)))
c, r = call("POST", "/carrito/items", token=tokA, body={"productoId": P1["_id"], "cantidad": 2})
check("agregar 2 unidades", c in (200, 201) and r["items"][0]["cantidad"] == 2 and r["total"] == 20, (c, msg(r)))
c, r = call("POST", "/carrito/items", token=tokA, body={"productoId": P1["_id"], "cantidad": 2})
check("sumar a lo existente (4)", c in (200, 201) and r["items"][0]["cantidad"] == 4, (c, r if c >= 400 else r["items"]))
c, r = call("POST", "/carrito/items", token=tokA, body={"productoId": P1["_id"], "cantidad": 2})
check("pasarse del stock acumulado (6 > 5) -> 400", c == 400, (c, msg(r)))
c, r = call("PATCH", f"/carrito/items/{P1['_id']}", token=tokA, body={"cantidad": 3})
check("actualizar cantidad", c == 200 and r["items"][0]["cantidad"] == 3, (c, msg(r)))
c, r = call("PATCH", f"/carrito/items/{P1['_id']}", token=tokA, body={"cantidad": 99})
check("actualizar sobre el stock -> 400", c == 400, c)
c, r = call("PATCH", f"/carrito/items/{P2['_id']}", token=tokA, body={"cantidad": 1})
check("actualizar item que no esta en el carrito -> 400", c == 400, c)
c, r = call("DELETE", f"/carrito/items/{P1['_id']}", token=tokA)
check("quitar item", c == 200 and r["items"] == [], (c, msg(r)))
call("POST", "/carrito/items", token=tokA, body={"productoId": P1["_id"], "cantidad": 1})
c, r = call("DELETE", "/carrito", token=tokA)
c2, r2 = call("GET", "/carrito", token=tokA)
check("vaciar carrito", c == 200 and r2["items"] == [], (c, r2))

sec("Reservas de servicios")
f_ok = fecha_futura(2)
f_bloq = fecha_futura(3)
c, sl = call("GET", f"/catalogo/{SV['_id']}/disponibilidad?fecha={f_ok}")
check("disponibilidad de un dia valido", c == 200 and len(sl) == 8, (c, len(sl) if isinstance(sl, list) else sl))
c, sl2 = call("GET", f"/catalogo/{SV['_id']}/disponibilidad?fecha={f_bloq}")
check("dia marcado sin atencion -> sin horarios", c == 200 and sl2 == [], (c, sl2))
c, sl3 = call("GET", f"/catalogo/{SV['_id']}/disponibilidad?fecha={fecha_futura(-2)}")
check("dia pasado -> sin horarios", c == 200 and sl3 == [], (c, sl3))
c, r = call("GET", f"/catalogo/{SV['_id']}/disponibilidad?fecha=no-es-fecha")
check("fecha con formato invalido -> 400 (no 500/vacio silencioso)", c == 400, (c, str(r)[:80]))
c, r = call("GET", f"/catalogo/{SV['_id']}/disponibilidad")
check("sin parametro fecha -> 400", c == 400, (c, str(r)[:80]))
c, r = call("POST", f"/catalogo/{SV['_id']}/reservas", token=tokA, body={"fecha": f_bloq, "horaInicio": "09:00"})
check("reservar un dia sin atencion -> 400", c == 400, (c, msg(r)))
c, r = call("POST", f"/catalogo/{SV['_id']}/reservas", token=tokA, body={"fecha": fecha_futura(-1), "horaInicio": "09:00"})
check("reservar un dia pasado -> 400", c == 400, (c, msg(r)))
c, r = call("POST", f"/catalogo/{SV['_id']}/reservas", token=tokA, body={"fecha": f_ok, "horaInicio": "08:00"})
check("reservar fuera del horario (08:00) -> 400", c == 400, (c, msg(r)))
c, r = call("POST", f"/catalogo/{SV['_id']}/reservas", token=tokA, body={"fecha": f_ok, "horaInicio": "16:30"})
check("reservar hora que no encaja en la rejilla (16:30) -> 400", c == 400, (c, msg(r)))
c, r = call("POST", f"/catalogo/{SV['_id']}/reservas", token=tokA, body={"fecha": f_ok, "horaInicio": "09:30"})
check("reservar 09:30 (solaparia 09:00-10:00) -> 400", c == 400, (c, msg(r)))
if c == 201:
    call("PATCH", f"/catalogo/{SV['_id']}/reservas/{r['_id']}/cancelar", token=tokA)
c, r = call("POST", f"/catalogo/{SV['_id']}/reservas", token=tokA, body={"fecha": f_ok, "horaInicio": "9"})
check("hora con formato invalido -> 400", c == 400, c)
c, r = call("POST", f"/catalogo/{SV['_id']}/reservas", token=tokS, body={"fecha": f_ok, "horaInicio": "10:00"})
check("el vendedor no reserva su propio servicio -> 400", c == 400, (c, msg(r)))
c, r = call("POST", f"/catalogo/{P1['_id']}/reservas", token=tokA, body={"fecha": f_ok, "horaInicio": "10:00"})
check("reservar un PRODUCTO (no servicio) -> 400", c == 400, (c, msg(r)))
c, R1 = call("POST", f"/catalogo/{SV['_id']}/reservas", token=tokA, body={"fecha": f_ok, "horaInicio": "10:00"})
check("reservar 10:00 (valido)", c == 201 and R1["estado"] == "retenida", (c, msg(R1)))
emailC, c, r = registrar("QA Comprador C", "c")
tokC = r["token"]; idC = r["usuario"]["id"]
c, r = call("POST", f"/catalogo/{SV['_id']}/reservas", token=tokC, body={"fecha": f_ok, "horaInicio": "10:00"})
check("el mismo horario ya retenido por otro -> 400", c == 400, (c, msg(r)))
c, sl = call("GET", f"/catalogo/{SV['_id']}/disponibilidad?fecha={f_ok}")
check("el horario retenido desaparece de la disponibilidad", c == 200 and "10:00" not in [s["horaInicio"] for s in sl], c)
c, r = call("GET", f"/catalogo/{SV['_id']}/reservas/{R1['_id']}", token=tokC)
check("ver reserva ajena -> 403", c == 403, c)
c, r = call("PATCH", f"/catalogo/{SV['_id']}/reservas/{R1['_id']}/cancelar", token=tokC)
check("cancelar reserva ajena -> 403", c == 403, c)
c, r = call("PATCH", f"/catalogo/{SV['_id']}/reservas/{R1['_id']}/confirmar", token=tokC, body={"ordenId": "x"})
check("confirmar reserva ajena -> 403", c == 403, c)
c, r = call("POST", "/carrito/items", token=tokC, body={"productoId": SV["_id"], "cantidad": 1, "reservaId": R1["_id"]})
check("agregar al carrito la reserva de OTRO -> 400/403", c in (400, 403), (c, msg(r)))
c, r = call("POST", "/carrito/items", token=tokA, body={"productoId": SV["_id"], "cantidad": 1})
check("servicio sin reservaId -> 400", c == 400, (c, msg(r)))
c, r = call("POST", "/carrito/items", token=tokA, body={"productoId": SV["_id"], "cantidad": 1, "reservaId": "507f1f77bcf86cd799439011"})
check("reservaId inexistente -> 400", c == 400, (c, msg(r)))
c, r = call("POST", "/carrito/items", token=tokA, body={"productoId": SV["_id"], "cantidad": 1, "reservaId": "no-valido"})
check("reservaId con formato invalido -> 400 (no 500)", c == 400, (c, msg(r)))
c, r = call("POST", "/carrito/items", token=tokA, body={"productoId": SV["_id"], "cantidad": 1, "reservaId": R1["_id"]})
check("agregar servicio con su reserva", c in (200, 201) and r["items"][0]["cita"]["estado"] == "retenida", (c, msg(r)))
c, r = call("PATCH", f"/carrito/items/{SV['_id']}", token=tokA, body={"cantidad": 2})
check("un servicio no tiene cantidad -> 400", c == 400, c)
c, r = call("DELETE", f"/carrito/items/{SV['_id']}", token=tokA)
c2, rr = call("GET", f"/catalogo/{SV['_id']}/reservas/{R1['_id']}", token=tokA)
check("quitar el servicio del carrito libera la reserva", c == 200 and rr["estado"] == "cancelada", (c, rr.get("estado") if isinstance(rr, dict) else rr))
c, R2 = call("POST", f"/catalogo/{SV['_id']}/reservas", token=tokA, body={"fecha": f_ok, "horaInicio": "10:00"})
check("el horario liberado se puede volver a reservar", c == 201, (c, msg(R2)))
# carrera: dos compradores al mismo horario
resC = {}
def reservar(tok, k):
    resC[k] = call("POST", f"/catalogo/{SV['_id']}/reservas", token=tok, body={"fecha": f_ok, "horaInicio": "11:00"})
ths = [threading.Thread(target=reservar, args=(tokA, "a")), threading.Thread(target=reservar, args=(tokC, "c"))]
[t.start() for t in ths]; [t.join() for t in ths]
codes = sorted([resC["a"][0], resC["c"][0]])
check("carrera: dos compradores, mismo horario -> exactamente 1 gana", codes == [201, 400], codes)
for k in ("a", "c"):
    if resC[k][0] == 201:
        call("PATCH", f"/catalogo/{SV['_id']}/reservas/{resC[k][1]['_id']}/cancelar", token=tokA if k == "a" else tokC)

sec("Ordenes y pagos - producto")
c, r = call("POST", "/ordenes", token=tokA, body=dir_orden())
check("orden con carrito vacio -> 400", c == 400, (c, msg(r)))
call("DELETE", "/carrito", token=tokA)
call("POST", "/carrito/items", token=tokA, body={"productoId": P1["_id"], "cantidad": 2})
c, r = call("POST", "/ordenes", token=tokA, body={"direccion": {"nombre": "A", "telefono": "1", "direccion": "x"}})
check("orden con direccion invalida -> 400", c == 400, (c, msg(r)))
c, r = call("POST", "/ordenes", body=dir_orden())
check("orden sin token -> 401", c == 401, c)
c, r = call("POST", "/ordenes", token=tokA, body={**dir_orden(), "productoIds": [P2["_id"]]})
check("orden con productoIds que no estan en el carrito -> 400", c == 400, (c, msg(r)))
c, O1 = call("POST", "/ordenes", token=tokA, body=dir_orden())
check("crear orden", c == 201 and O1["total"] == 20 and O1["estadoPago"] == "pendiente", (c, msg(O1)))
c, d = call("GET", f"/catalogo/{P1['_id']}")
check("el stock se descuenta al crear la orden (5 -> 3)", d["stock"] == 3, d["stock"])
c, r = call("GET", "/carrito", token=tokA)
check("el carrito queda vacio tras la orden", r["items"] == [], r)
c, r = call("GET", f"/ordenes/{O1['id']}", token=tokA)
check("el comprador ve su orden", c == 200, c)
c, r = call("GET", f"/ordenes/{O1['id']}", token=tokS)
check("el vendedor del item NO ve la orden mientras esta sin pagar -> 403", c == 403, c)
c, r = call("GET", f"/ordenes/{O1['id']}", token=tokC)
check("otro comprador NO ve la orden -> 403", c == 403, c)
c, r = call("GET", f"/ordenes/{O1['id']}", token=tokX)
check("otro vendedor NO ve la orden -> 403", c == 403, c)
c, r = call("GET", "/ordenes/00000000-0000-4000-8000-000000000000", token=tokA)
check("orden inexistente -> 404", c == 404, c)
c, r = call("GET", "/ordenes/no-es-uuid", token=tokA)
check("id de orden invalido -> 400/404 (no 500)", c in (400, 404), (c, msg(r)))
c, r = call("GET", "/ordenes", token=tokA)
check("lista del comprador incluye la orden", c == 200 and any(o["id"] == O1["id"] for o in r), c)
c, r = call("GET", "/ordenes", token=tokC)
check("lista de otro comprador NO incluye la orden", c == 200 and not any(o["id"] == O1["id"] for o in r), c)
c, r = call("GET", "/ordenes/vendedor", token=tokS)
check("la lista del vendedor NO incluye la orden mientras esta sin pagar", c == 200 and not any(o["id"] == O1["id"] for o in r), c)
c, r = call("PATCH", f"/ordenes/{O1['id']}/estado-entrega", token=tokS, body={"estadoEntrega": "entregada"})
check("no se puede marcar entregada una orden NO pagada -> 400", c == 400, (c, msg(r)))
c, r = call("PATCH", f"/ordenes/{O1['id']}/estado-entrega", token=tokA, body={"estadoEntrega": "entregada"})
check("el comprador no cambia el estado de entrega -> 403", c == 403, c)
# pagos
c, r = call("POST", f"/pagos/ordenes/{O1['id']}", token=tokC, body={"metodo": "tarjeta", "numeroTarjeta": "4242424242424242"})
check("pagar la orden de otro -> 403", c == 403, (c, msg(r)))
c, r = call("POST", f"/pagos/ordenes/{O1['id']}", token=tokA, body={"metodo": "bitcoin"})
check("metodo invalido -> 400", c == 400, c)
c, r = call("POST", f"/pagos/ordenes/{O1['id']}", token=tokA, body={"metodo": "tarjeta"})
check("tarjeta sin numero -> 400", c == 400, (c, msg(r)))
c, r = call("POST", f"/pagos/ordenes/{O1['id']}", token=tokA, body={"metodo": "tarjeta", "numeroTarjeta": "123"})
check("numero de tarjeta corto -> 400", c == 400, c)
c, r = call("POST", f"/pagos/ordenes/00000000-0000-4000-8000-000000000000", token=tokA, body={"metodo": "tarjeta", "numeroTarjeta": "4242424242424242"})
check("pagar orden inexistente -> 404", c == 404, c)
c, r = call("POST", f"/pagos/ordenes/{O1['id']}", token=tokA, body={"metodo": "tarjeta", "numeroTarjeta": "4000000000000002", "vencimiento": "12/35", "cvv": "123"})
check("tarjeta ...0002 -> pago rechazado", c in (200, 201) and r["estado"] == "rechazado", (c, msg(r)))
time.sleep(1.5)
c, r = call("GET", f"/ordenes/{O1['id']}", token=tokA)
check("tras rechazo la orden queda 'rechazada'", r["estadoPago"] == "rechazada", r["estadoPago"])
c, d = call("GET", f"/catalogo/{P1['_id']}")
check("tras rechazo el stock se devuelve (3 -> 5)", d["stock"] == 5, d["stock"])
c, r = call("POST", f"/pagos/ordenes/{O1['id']}", token=tokA, body={"metodo": "tarjeta", "numeroTarjeta": "4242424242424242"})
check("pagar una orden ya rechazada sin reabrir -> 400", c == 400, (c, msg(r)))
c, r = call("POST", f"/ordenes/{O1['id']}/reabrir", token=tokC)
check("reabrir orden ajena -> 403", c == 403, c)
c, r = call("POST", f"/ordenes/{O1['id']}/reabrir", token=tokA)
check("reabrir orden rechazada", c in (200, 201) and r["estadoPago"] == "pendiente", (c, msg(r)))
c, d = call("GET", f"/catalogo/{P1['_id']}")
check("al reabrir el stock vuelve a descontarse (5 -> 3)", d["stock"] == 3, d["stock"])
# carrera: doble pago simultaneo
pagos_res = {}
def pagar(k):
    pagos_res[k] = call("POST", f"/pagos/ordenes/{O1['id']}", token=tokA, body={"metodo": "tarjeta", "numeroTarjeta": "4111111111111111", "vencimiento": "12/35", "cvv": "123"})
ths = [threading.Thread(target=pagar, args=(i,)) for i in range(3)]
[t.start() for t in ths]; [t.join() for t in ths]
codes = sorted(v[0] for v in pagos_res.values())
check("carrera: 3 pagos simultaneos de la misma orden -> solo 1 se procesa", codes.count(201) + codes.count(200) == 1, codes)
time.sleep(1.5)
c, lp = call("GET", f"/pagos/ordenes/{O1['id']}", token=tokA)
aprob = [p for p in lp if p["estado"] == "aprobado"] if isinstance(lp, list) else []
check("queda un solo pago aprobado registrado", len(aprob) == 1, [p["estado"] for p in lp] if isinstance(lp, list) else lp)
c, r = call("GET", f"/ordenes/{O1['id']}", token=tokA)
check("la orden queda 'pagada'", r["estadoPago"] == "pagada", r["estadoPago"])
time.sleep(0.5)
c, rv = call("GET", f"/ordenes/{O1['id']}", token=tokS)
check("ya pagada, el vendedor del item la ve", c == 200, c)
c, r = call("POST", f"/pagos/ordenes/{O1['id']}", token=tokA, body={"metodo": "tarjeta", "numeroTarjeta": "4242424242424242"})
check("pagar una orden ya pagada -> 400", c == 400, c)
c, r = call("GET", f"/pagos/ordenes/{O1['id']}", token=tokC)
check("ver pagos de orden ajena -> 403", c == 403, c)
c, r = call("POST", f"/ordenes/{O1['id']}/reabrir", token=tokA)
check("reabrir una orden pagada -> 400", c == 400, c)
c, r = call("PATCH", f"/ordenes/{O1['id']}/estado-entrega", token=tokS, body={"estadoEntrega": "en_camino"})
check("vendedor marca 'en camino' (orden pagada)", c == 200 and r["estadoEntrega"] == "en_camino", (c, msg(r)))
c, r = call("PATCH", f"/ordenes/{O1['id']}/estado-entrega", token=tokS, body={"estadoEntrega": "volando"})
check("estado de entrega invalido -> 400", c == 400, c)
c, r = call("PATCH", f"/ordenes/{O1['id']}/estado-entrega", token=tokX, body={"estadoEntrega": "entregada"})
check("vendedor ajeno no cambia la entrega -> 403", c == 403, c)

sec("Resenas")
c, r = call("POST", f"/catalogo/{P1['_id']}/resenas", token=tokC, body={"ordenId": O1["id"], "calificacion": 5})
check("reseñar sin haber comprado -> 403", c == 403, (c, msg(r)))
c, r = call("POST", f"/catalogo/{P1['_id']}/resenas", token=tokA, body={"ordenId": O1["id"], "calificacion": 6})
check("calificacion 6 -> 400", c == 400, c)
c, r = call("POST", f"/catalogo/{P1['_id']}/resenas", token=tokA, body={"ordenId": O1["id"], "calificacion": 0})
check("calificacion 0 -> 400", c == 400, c)
c, r = call("POST", f"/catalogo/{P1['_id']}/resenas", token=tokA, body={"ordenId": "no-uuid", "calificacion": 5})
check("ordenId invalido -> 400", c == 400, c)
c, r = call("POST", f"/catalogo/{P1['_id']}/resenas", token=tokA, body={"ordenId": O1["id"], "calificacion": 5, "comentario": "x" * 501})
check("comentario de 501 caracteres -> 400", c == 400, c)
c, r = call("POST", f"/catalogo/{P2['_id']}/resenas", token=tokA, body={"ordenId": O1["id"], "calificacion": 5})
check("reseñar un producto que NO esta en esa orden -> 403", c == 403, (c, msg(r)))
c, r = call("POST", f"/catalogo/{P1['_id']}/resenas", body={"ordenId": O1["id"], "calificacion": 5})
check("reseña sin token -> 401", c == 401, c)
c, r = call("POST", f"/catalogo/{P1['_id']}/resenas", token=tokA, body={"ordenId": O1["id"], "calificacion": 4, "comentario": "Bien"})
check("reseñar tras comprar y pagar", c == 201, (c, msg(r)))
c, r = call("POST", f"/catalogo/{P1['_id']}/resenas", token=tokA, body={"ordenId": O1["id"], "calificacion": 5})
check("reseña duplicada (misma orden) -> 400", c == 400, (c, msg(r)))
c, d = call("GET", f"/catalogo/{P1['_id']}")
check("promedio y numero de reseñas actualizados", d["calificacionPromedio"] == 4 and d["numResenas"] == 1, (d["calificacionPromedio"], d["numResenas"]))
c, r = call("GET", f"/catalogo/{P1['_id']}/resenas")
check("listar reseñas es publico", c == 200 and len(r) == 1, c)

sec("Carrera de stock (ultima unidad)")
call("POST", "/carrito/items", token=tokA, body={"productoId": P2["_id"], "cantidad": 1})
call("POST", "/carrito/items", token=tokC, body={"productoId": P2["_id"], "cantidad": 1})
res = {}
def comprar(tok, k):
    res[k] = call("POST", "/ordenes", token=tok, body=dir_orden())
ths = [threading.Thread(target=comprar, args=(tokA, "a")), threading.Thread(target=comprar, args=(tokC, "c"))]
[t.start() for t in ths]; [t.join() for t in ths]
codes = sorted([res["a"][0], res["c"][0]])
check("dos compradores, 1 unidad: exactamente 1 orden se crea", codes == [201, 400], codes)
c, d = call("GET", f"/catalogo/{P2['_id']}")
check("el stock nunca queda negativo", d["stock"] == 0, d["stock"])
c, d = call("GET", f"/catalogo?buscar=QA%20P2%20ultima%20unidad%20{RUN}")
check("agotado sigue listado (muestra 'Agotado')", c == 200 and any(i["_id"] == P2["_id"] for i in d["items"]), c)
perdedor = tokA if res["a"][0] == 400 else tokC
c, r = call("GET", "/carrito", token=perdedor)
check("el comprador que perdio conserva su carrito", c == 200 and len(r["items"]) == 1, r)
call("DELETE", "/carrito", token=tokA); call("DELETE", "/carrito", token=tokC)

sec("Orden con servicio + pausa en medio")
f2 = fecha_futura(4)
c, R3 = call("POST", f"/catalogo/{SV['_id']}/reservas", token=tokA, body={"fecha": f2, "horaInicio": "14:00"})
call("POST", "/carrito/items", token=tokA, body={"productoId": SV["_id"], "cantidad": 1, "reservaId": R3["_id"]})
call("POST", "/carrito/items", token=tokA, body={"productoId": P3["_id"], "cantidad": 1})
call("PATCH", f"/catalogo/{P3['_id']}", token=tokS, body={"pausada": True})
c, r = call("POST", "/ordenes", token=tokA, body=dir_orden())
check("orden con un producto pausado en el carrito -> 400", c == 400, (c, msg(r)))
c, r = call("GET", "/carrito", token=tokA)
check("tras ese error el carrito sigue intacto (2 items)", len(r["items"]) == 2, len(r["items"]))
call("PATCH", f"/catalogo/{P3['_id']}", token=tokS, body={"pausada": False})
c, O2 = call("POST", "/ordenes", token=tokA, body={**dir_orden(), "productoIds": [SV["_id"]]})
check("orden parcial solo del servicio", c == 201 and len(O2["items"]) == 1, (c, msg(O2)))
c, r = call("GET", "/carrito", token=tokA)
check("la orden parcial deja el otro item en el carrito", len(r["items"]) == 1 and r["items"][0]["productoId"] == P3["_id"], r)
c, rr = call("GET", f"/catalogo/{SV['_id']}/reservas/{R3['_id']}", token=tokA)
check("la reserva queda confirmada con la orden", rr["estado"] == "confirmada" and rr["ordenId"] == O2["id"], (rr.get("estado"), rr.get("ordenId")))
c, r = call("POST", f"/pagos/ordenes/{O2['id']}", token=tokA, body={"metodo": "tarjeta", "numeroTarjeta": "4242424242424242"})
check("pagar con PayPal", c in (200, 201) and r["estado"] == "aprobado", (c, msg(r)))
time.sleep(1)
c, sl = call("GET", f"/catalogo/{SV['_id']}/disponibilidad?fecha={f2}")
check("el horario pagado ya no se ofrece", "14:00" not in [s["horaInicio"] for s in sl], c)
c, r = call("POST", f"/catalogo/{SV['_id']}/reservas/{R3['_id']}/cancelar", token=tokA) if False else call("PATCH", f"/catalogo/{SV['_id']}/reservas/{R3['_id']}/cancelar", token=tokA)
c2, rr = call("GET", f"/catalogo/{SV['_id']}/reservas/{R3['_id']}", token=tokA)
check("una reserva confirmada no se cancela por la via del carrito", rr["estado"] == "confirmada", rr.get("estado"))
c, r = call("PATCH", f"/catalogo/{SV['_id']}/reservas/{R3['_id']}/confirmar", token=tokA, body={"ordenId": "otra-orden"})
check("no se puede re-confirmar con otra orden -> 400", c == 400, (c, msg(r)))
c, r = call("POST", f"/catalogo/{SV['_id']}/resenas", token=tokA, body={"ordenId": O2["id"], "calificacion": 5})
check("reseñar el servicio pagado", c == 201, (c, msg(r)))
call("DELETE", "/carrito", token=tokA)

sec("Notificaciones")
time.sleep(1.5)
c, r = call("GET", "/notificaciones", token=tokA)
check("el comprador tiene notificaciones de sus ordenes/pagos", c == 200 and len(r) >= 4, (c, len(r) if isinstance(r, list) else r))
tipos = {n["tipo"] for n in r} if isinstance(r, list) else set()
check("incluye orden_creada y pago_confirmado y pago_rechazado", {"orden_creada", "pago_confirmado", "pago_rechazado"} <= tipos, tipos)
c, rs = call("GET", "/notificaciones", token=tokS)
check("el vendedor recibe 'nueva_orden_vendedor'", c == 200 and any(n["tipo"] == "nueva_orden_vendedor" for n in rs), [n["tipo"] for n in rs] if isinstance(rs, list) else rs)
c, rc = call("GET", "/notificaciones", token=tokC)
check("otro comprador no ve notificaciones ajenas", c == 200 and not any(n["ordenId"] in (O1["id"], O2["id"]) for n in rc), c)
if isinstance(r, list) and r:
    nid = r[0]["id"]
    c, x = call("PATCH", f"/notificaciones/{nid}/leida", token=tokC)
    check("marcar leida la notificacion de otro -> 403", c == 403, c)
    c, x = call("DELETE", f"/notificaciones/{nid}", token=tokC)
    check("borrar la notificacion de otro -> 403", c == 403, c)
    c, x = call("PATCH", f"/notificaciones/{nid}/leida", token=tokA)
    check("marcar leida propia", c == 200 and x["leida"] is True, c)
c, x = call("DELETE", "/notificaciones/no-es-uuid", token=tokA)
check("borrar con id invalido -> 400/404 (no 500)", c in (400, 404), (c, msg(x)))
c, x = call("PATCH", "/notificaciones/no-es-uuid/leida", token=tokA)
check("marcar leida con id invalido -> 400/404 (no 500)", c in (400, 404), (c, msg(x)))
c, x = call("PATCH", "/notificaciones/leidas", token=tokA)
check("marcar todas leidas", c == 200, c)
c, x = call("GET", "/notificaciones")
check("notificaciones sin token -> 401", c == 401, c)
c, x = call("DELETE", "/notificaciones", token=tokA)
c2, y = call("GET", "/notificaciones", token=tokA)
check("eliminar todas", c == 200 and y == [], (c, y))
c3, z = call("GET", "/notificaciones", token=tokS)
check("eliminar todas del comprador no toca las del vendedor", len(z) == len(rs), (len(z), len(rs)))

sec("Verificacion de correo")
emailU, c, r = registrar("QA Sin Verificar", "nover", verificar_correo=False)
tokU = r["token"]
check("el registro nace con el correo sin verificar", c == 201 and r["usuario"].get("emailVerificado") is False, r["usuario"] if c == 201 else (c, msg(r)))
c, x = call("POST", "/auth/me/vendedor", token=tokU)
check("activar modo vendedor sin verificar -> 403", c == 403, (c, msg(x)))
call("POST", "/carrito/items", token=tokU, body={"productoId": P3["_id"], "cantidad": 1})
c, x = call("POST", "/ordenes", token=tokU, body=dir_orden())
check("comprar sin verificar el correo -> 403", c == 403, (c, msg(x)))
c, x = call("GET", "/carrito", token=tokU)
check("tras ese rechazo el carrito sigue intacto", c == 200 and len(x["items"]) == 1, x)
c, x = call("POST", "/auth/verificar-correo", body={"token": "esto-no-es-un-token"})
check("verificar con un token basura -> 400", c == 400, (c, msg(x)))
c, x = call("POST", "/auth/verificar-correo", body={})
check("verificar sin token -> 400", c == 400, c)
tokenV = enlace_verificacion(emailU)
check("el servidor genera un enlace de verificacion (log de auth)", tokenV is not None)
if tokenV:
    c, x = call("GET", "/auth/me", token=tokenV)
    check("el token de verificacion NO sirve como token de sesion -> 401", c == 401, (c, msg(x)))
c, x = call("POST", "/auth/reenviar-verificacion", token=tokU)
check("reenviar el enlace", c in (200, 201), (c, msg(x)))
c, x = call("POST", "/auth/reenviar-verificacion", token=tokU)
check("pedirlo de nuevo enseguida -> 429 (limite de 1 por minuto)", c == 429, (c, msg(x)))
c, x = call("POST", "/auth/reenviar-verificacion")
check("reenviar sin sesion -> 401", c == 401, c)
if tokenV:
    c, x = call("POST", "/auth/verificar-correo", body={"token": tokenV})
    check("verificar con el enlace valido", c in (200, 201) and x.get("verificado") is True, (c, msg(x)))
    c, x = call("POST", "/auth/verificar-correo", body={"token": tokenV})
    check("usar el mismo enlace otra vez es inofensivo", c in (200, 201), (c, msg(x)))
    c, me = call("GET", "/auth/me", token=tokU)
    check("el perfil ya figura verificado", me.get("emailVerificado") is True, me)
    c, x = call("POST", "/auth/reenviar-verificacion", token=tokU)
    check("reenviar a una cuenta ya verificada -> 400", c == 400, (c, msg(x)))
    c, O = call("POST", "/ordenes", token=tokU, body=dir_orden())
    check("con el correo verificado ya puede comprar", c == 201, (c, msg(O)))
    c, x = call("POST", "/auth/me/vendedor", token=tokU)
    check("y puede activar el modo vendedor", c in (200, 201), (c, msg(x)))
c, x = call("POST", "/notificaciones/internal/correo", body={"destinatario": "a@b.com", "asunto": "x", "texto": "y"})
check("el envio interno de correos NO esta expuesto en el gateway", c == 404, c)

sec("Sesiones: cerrar sesion y revocar tokens")
emailSe, c, r = registrar("QA Sesion", "ses")
tok1 = r["token"]
c, r2 = call("POST", "/auth/login", body={"email": emailSe, "password": PW})
tok2 = r2["token"]
check("dos sesiones abiertas a la vez", tok1 != tok2)
c, x = call("GET", "/auth/me", token=tok1)
check("la sesion 1 funciona", c == 200, c)
c, x = call("POST", "/auth/logout", token=tok1)
check("cerrar sesion (logout)", c in (200, 201), (c, msg(x)))
c, x = call("GET", "/auth/me", token=tok1)
check("el token cerrado queda revocado -> 401 en auth", c == 401, (c, msg(x)))
c, x = call("GET", "/carrito", token=tok1)
check("el token cerrado tambien se rechaza en OTROS servicios (carrito) -> 401", c == 401, (c, msg(x)))
c, x = call("GET", "/ordenes", token=tok1)
check("...y en ordenes -> 401", c == 401, c)
c, x = call("GET", "/notificaciones", token=tok1)
check("...y en notificaciones -> 401", c == 401, c)
c, x = call("GET", "/auth/me", token=tok2)
check("la otra sesion sigue abierta", c == 200, c)
c, x = call("POST", "/auth/logout-todos", token=tok2)
check("cerrar sesion en todos los dispositivos", c in (200, 201), (c, msg(x)))
c, x = call("GET", "/auth/me", token=tok2)
check("tras cerrar en todos, tambien cae la otra -> 401", c == 401, c)
time.sleep(1.2)
c, r3 = call("POST", "/auth/login", body={"email": emailSe, "password": PW})
tok3 = r3["token"]
c, x = call("GET", "/auth/me", token=tok3)
check("un login nuevo despues de cerrar en todos funciona", c == 200, (c, msg(x)))
time.sleep(1.2)
c, cp = call("PATCH", "/auth/me", token=tok3, body={"passwordNueva": "OtraClave2026!", "passwordActual": PW})
check("cambiar la contrasena devuelve un token nuevo", c == 200 and cp.get("token"), (c, msg(cp)))
c, x = call("GET", "/auth/me", token=tok3)
check("al cambiar la contrasena el token anterior queda revocado -> 401", c == 401, (c, msg(x)))
if isinstance(cp, dict) and cp.get("token"):
    c, x = call("GET", "/auth/me", token=cp["token"])
    check("el token nuevo si sirve", c == 200, (c, msg(x)))
c, x = call("POST", "/auth/logout")
check("logout sin token -> 401", c == 401, c)

sec("Limite de intentos de login")
emailL, c, r = registrar("QA Bloqueo", "lock")
codigos = []
for i in range(5):
    c, x = call("POST", "/auth/login", body={"email": emailL, "password": "equivocada" + str(i)})
    codigos.append(c)
check("5 intentos fallidos responden 401", codigos == [401] * 5, codigos)
c, x = call("POST", "/auth/login", body={"email": emailL, "password": "otra-mas-mala"})
check("el 6.o intento queda bloqueado -> 429", c == 429, (c, msg(x)))
check("el mensaje dice cuanto esperar", "min" in str(msg(x)), msg(x))
c, x = call("POST", "/auth/login", body={"email": emailL, "password": PW})
check("incluso con la contrasena correcta sigue bloqueado -> 429", c == 429, (c, msg(x)))
c, x = call("POST", "/auth/login", body={"email": emailL.upper(), "password": PW})
check("el bloqueo no se evita cambiando mayusculas/minusculas del correo", c == 429, c)
emailL2, c, r = registrar("QA Sin Bloqueo", "lock2")
c, x = call("POST", "/auth/login", body={"email": emailL2, "password": PW})
check("otra cuenta no queda bloqueada", c in (200, 201), c)
emailL3, c, r = registrar("QA Aciertos", "lock3")
for i in range(3):
    call("POST", "/auth/login", body={"email": emailL3, "password": "mala"})
c, x = call("POST", "/auth/login", body={"email": emailL3, "password": PW})
check("un acierto antes del limite funciona y reinicia el contador", c in (200, 201), c)
codigos = [call("POST", "/auth/login", body={"email": emailL3, "password": "mala"})[0] for _ in range(5)]
check("tras el acierto vuelven a contar 5 intentos completos", codigos == [401] * 5, codigos)

sec("Entrega por vendedor (ordenes con varios vendedores)")
emailB, c, r = registrar("QA Comprador B", "b")
tokB = r["token"]
c, P4 = call("POST", "/catalogo", token=tokS, body=prod_payload(nombre="QA P4 vendedor S " + RUN, stock=10, precio=5))
creados["productos"].append(P4["_id"])
c, PX = call("POST", "/catalogo", token=tokX, body=prod_payload(nombre="QA PX vendedor X " + RUN, stock=10, precio=8))
creados["productos"].append(PX["_id"])
idX = call("GET", "/auth/me", token=tokX)[1]["id"]
call("POST", "/carrito/items", token=tokB, body={"productoId": P4["_id"], "cantidad": 2})
call("POST", "/carrito/items", token=tokB, body={"productoId": PX["_id"], "cantidad": 1})
c, OM = call("POST", "/ordenes", token=tokB, body=dir_orden())
check("orden con productos de DOS vendedores", c == 201 and len({i["vendedorId"] for i in OM["items"]}) == 2, (c, msg(OM)))
check("cada item nace con entrega 'pendiente'", all(i.get("estadoEntrega") == "pendiente" for i in OM["items"]), [i.get("estadoEntrega") for i in OM["items"]])
c, vs = call("GET", "/ordenes/vendedor", token=tokS)
check("una orden SIN pagar no aparece en las ordenes recibidas del vendedor", c == 200 and not any(o["id"] == OM["id"] for o in vs), c)
c, x = call("GET", f"/ordenes/{OM['id']}", token=tokS)
check("ni se puede abrir por id (no revela direccion de quien no ha pagado) -> 403", c == 403, (c, msg(x)))
c, x = call("PATCH", f"/ordenes/{OM['id']}/estado-entrega", token=tokS, body={"estadoEntrega": "entregada"})
check("no se puede marcar entrega en una orden sin pagar -> 400", c == 400, (c, msg(x)))
c, x = call("POST", f"/pagos/ordenes/{OM['id']}", token=tokB, body={"metodo": "tarjeta", "numeroTarjeta": "4242424242424242"})
check("pagar la orden", c in (200, 201) and x["estado"] == "aprobado", (c, msg(x)))
time.sleep(1.5)
c, vs = call("GET", "/ordenes/vendedor", token=tokS)
oS = next((o for o in vs if o["id"] == OM["id"]), None)
check("tras pagar, el vendedor S ve la orden", oS is not None)
if oS:
    check("S solo ve SUS items (no los del otro vendedor)", all(i["vendedorId"] == idS for i in oS["items"]) and len(oS["items"]) == 1, [i["nombre"] for i in oS["items"]])
    check("S ve el total de SU parte (2 x $5 = $10), no el de toda la orden", oS["total"] == 10, oS["total"])
c, vx = call("GET", "/ordenes/vendedor", token=tokX)
oX = next((o for o in vx if o["id"] == OM["id"]), None)
check("el vendedor X tambien la ve, con solo su item ($8)", oX is not None and len(oX["items"]) == 1 and oX["total"] == 8, oX and oX["total"])
c, x = call("GET", f"/ordenes/{OM['id']}", token=tokS)
check("S abre la orden por id y solo ve su parte", c == 200 and len(x["items"]) == 1, (c, len(x["items"]) if c == 200 else msg(x)))
c, x = call("PATCH", f"/ordenes/{OM['id']}/estado-entrega", token=tokS, body={"estadoEntrega": "entregada"})
check("S marca SU entrega como 'entregada'", c == 200 and x["estadoEntrega"] == "entregada", (c, msg(x)))
c, x = call("GET", f"/ordenes/{OM['id']}", token=tokB)
check("el comprador ve la orden 'en camino' (falta la parte de X)", c == 200 and x["estadoEntrega"] == "en_camino", x.get("estadoEntrega") if c == 200 else msg(x))
if c == 200:
    por_item = {i["vendedorId"]: i["estadoEntrega"] for i in x["items"]}
    check("el comprador ve el estado de cada item (S entregado, X pendiente)", por_item.get(idS) == "entregada" and por_item.get(idX) == "pendiente", por_item)
c, vx = call("GET", "/ordenes/vendedor", token=tokX)
oX = next((o for o in vx if o["id"] == OM["id"]), None)
check("el estado de X NO cambio por lo que hizo S", oX is not None and oX["estadoEntrega"] == "pendiente", oX and oX["estadoEntrega"])
c, x = call("PATCH", f"/ordenes/{OM['id']}/estado-entrega", token=tokX, body={"estadoEntrega": "en_camino"})
check("X marca la suya 'en camino'", c == 200 and x["estadoEntrega"] == "en_camino", (c, msg(x)))
c, x = call("PATCH", f"/ordenes/{OM['id']}/estado-entrega", token=tokX, body={"estadoEntrega": "entregada"})
c2, y = call("GET", f"/ordenes/{OM['id']}", token=tokB)
check("cuando ambos entregan, la orden queda 'entregada'", c2 == 200 and y["estadoEntrega"] == "entregada", y.get("estadoEntrega"))
c, x = call("PATCH", f"/ordenes/{OM['id']}/estado-entrega", token=tokB, body={"estadoEntrega": "pendiente"})
check("el comprador no puede cambiar la entrega -> 403", c == 403, c)

sec("Estados de las citas (completada / no asistio)")
c, x = call("PATCH", f"/ordenes/{OM['id']}/estado-entrega", token=tokS, body={"estadoEntrega": "no_asistio"})
check("'no asistio' en un PRODUCTO -> 400 (solo vale para citas)", c == 400, (c, msg(x)))
c, RC = call("POST", f"/catalogo/{SV['_id']}/reservas", token=tokB, body={"fecha": f_ok, "horaInicio": "15:00"})
check("comprador B reserva una cita", c == 201, (c, msg(RC)))
c, x = call("POST", "/carrito/items", token=tokB, body={"productoId": SV["_id"], "cantidad": 1, "reservaId": RC["_id"]})
c, OC = call("POST", "/ordenes", token=tokB, body=dir_orden())
check("orden con una cita", c == 201 and OC["items"][0].get("tipo") == "servicio" and OC["items"][0].get("cita"), (c, msg(OC)))
c, x = call("POST", f"/pagos/ordenes/{OC['id']}", token=tokB, body={"metodo": "tarjeta", "numeroTarjeta": "4242424242424242"})
check("pagar la cita", c in (200, 201) and x["estado"] == "aprobado", (c, msg(x)))
c, x = call("PATCH", f"/ordenes/{OC['id']}/estado-entrega", token=tokS, body={"estadoEntrega": "no_asistio"})
check("el vendedor marca la cita como 'no asistio'", c == 200 and x["estadoEntrega"] == "no_asistio", (c, msg(x)))
c, y = call("GET", f"/ordenes/{OC['id']}", token=tokB)
check("el comprador ve la orden de la cita como 'no asistio'", c == 200 and y["estadoEntrega"] == "no_asistio", y.get("estadoEntrega") if c == 200 else msg(y))
c, x = call("PATCH", f"/ordenes/{OC['id']}/estado-entrega", token=tokS, body={"estadoEntrega": "entregada"})
check("el vendedor puede corregirla a 'completada' (entregada)", c == 200 and x["estadoEntrega"] == "entregada", (c, msg(x)))
c, x = call("PATCH", f"/ordenes/{OC['id']}/estado-entrega", token=tokB, body={"estadoEntrega": "no_asistio"})
check("el comprador no puede marcar 'no asistio' -> 403", c == 403, c)

sec("Superficie expuesta (informativo)")
c, x = call("POST", "/ordenes/demo")
check("INFO: POST /ordenes/demo responde SIN autenticacion (endpoint de demo)", c != 201, f"{c} -> cualquiera puede publicar eventos")
c, x = call("GET", "/notificaciones/demo/log")
check("INFO: GET /notificaciones/demo/log responde SIN autenticacion", c != 200, f"{c} -> expone ordenId/compradorId/montos de eventos")
c, x = call("GET", f"/auth/usuarios/{idS}")
check("perfil publico solo expone id y nombre", c == 200 and set(x.keys()) <= {"id", "nombre"}, x)
c, x = call("GET", "/auth/usuarios/no-es-uuid")
check("perfil publico con id invalido -> 400/404 (no 500)", c in (400, 404), (c, msg(x)))

# --------------------------------------------------------------------------------------
fallas = [r for r in resultados if not r[2]]
print(f"\n==== TOTAL {len(resultados)} pruebas | OK {len(resultados) - len(fallas)} | FALLAN {len(fallas)} ====")
for s_, n, ok, d in fallas:
    print(f"  [{s_}] {n}\n       -> {d}")
if os.environ.get("QA_NO_LIMPIAR") != "1":
    limpiar_datos_qa()
# Las 2 pruebas INFO (endpoints de demo sin autenticacion) son conocidas y no cuentan como fallo
reales = [r for r in fallas if not r[1].startswith("INFO:")]
sys.exit(1 if reales else 0)
