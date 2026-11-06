#!/usr/bin/env python3
"""Siembra ORDENES FICTICIAS para las cuentas vendedoras de la seed (*-seed@example.com).

Crea (todo ficticio, para que el panel del vendedor tenga datos de ejemplo):
  - 5 cuentas compradoras `*-seed@example.com` (misma contrasena que las vendedoras de la seed: se copia su hash)
  - ordenes de productos y de citas de servicio de cada vendedor, con estados variados (pendiente, en camino,
    entregada, agendada, completada, no asistio, cancelada, por cobrar...), sus pagos y las reservas de las citas
  - descuenta el stock de los productos vendidos

Es idempotente: antes de sembrar borra las ordenes/pagos/reservas de esos compradores y devuelve el stock.
Despues de correrlo: `bash scripts/backup-seed.sh` para guardarlo en el respaldo de la seed.

Uso (desde proyecto-marketplace/app, con los contenedores arriba):  python scripts/sembrar-ordenes.py
"""
import datetime as dt
import json
import random
import subprocess
import sys
import uuid

SEMILLA = 20261106
HOY = dt.date(2026, 11, 6)  # "hoy" de la seed: las citas pasadas son anteriores, las agendadas posteriores

COMPRADORES = [
    ("Ana Morales", "ana.morales-seed@example.com", "6612-3401", "Calle 50, Bella Vista, Ciudad de Panamá"),
    ("Luis Herrera", "luis.herrera-seed@example.com", "6234-8877", "Vía España, El Cangrejo, Ciudad de Panamá"),
    ("María Castillo", "maria.castillo-seed@example.com", "6788-1203", "Costa del Este, PH Vista Mar, apto 12B"),
    ("Carlos Quintero", "carlos.quintero-seed@example.com", "6345-9021", "Calle 12 Este, San Francisco, Ciudad de Panamá"),
    ("Daniela Ríos", "daniela.rios-seed@example.com", "6901-5567", "Altos de Panamá, Casa 24, Ciudad de Panamá"),
]

ORDENES_POR_VENDEDOR = {
    "tecnopanama-seed@example.com": 8,
    "bellastudio-seed@example.com": 6,
    "modaurbana-seed@example.com": 4,
    "asesorespanama-seed@example.com": 4,
    "profix-seed@example.com": 4,
    "casalista-seed@example.com": 4,
    "tallerbarrofino-seed@example.com": 3,
    "aulaviva-seed@example.com": 3,
}


def leer_env():
    env = {}
    try:
        for linea in open(".env", encoding="utf-8"):
            linea = linea.strip()
            if linea and not linea.startswith("#") and "=" in linea:
                k, v = linea.split("=", 1)
                env[k] = v
    except FileNotFoundError:
        pass
    return env


ENV = leer_env()
PG_USER = ENV.get("POSTGRES_USER", "marketplace")
PG_DB = ENV.get("POSTGRES_DB", "marketplace")


def psql(sql, entrada=None):
    cmd = ["docker", "compose", "exec", "-T", "postgres", "psql", "-q", "-At", "-U", PG_USER, "-d", PG_DB]
    r = subprocess.run(cmd + (["-c", sql] if entrada is None else []), input=entrada, capture_output=True, text=True, encoding="utf-8")
    if r.returncode != 0:
        sys.exit(f"psql falló:\n{r.stderr}")
    return r.stdout


def mongosh(js):
    r = subprocess.run(
        ["docker", "compose", "exec", "-T", "mongo", "mongosh", "catalogo", "--quiet", "--eval", js],
        capture_output=True, text=True, encoding="utf-8",
    )
    if r.returncode != 0:
        sys.exit(f"mongosh falló:\n{r.stderr}")
    return r.stdout


def q(valor):
    """Literal SQL entre comillas simples."""
    return "'" + str(valor).replace("'", "''") + "'"


def a_utc(fecha, hora_panama):
    """Panamá es UTC-5 fijo: la base guarda UTC sin zona."""
    return dt.datetime.combine(fecha, hora_panama) + dt.timedelta(hours=5)


def a_min(h):
    return int(h[:2]) * 60 + int(h[3:5])


def de_min(m):
    return f"{m // 60:02d}:{m % 60:02d}"


def main():
    rng = random.Random(SEMILLA)

    # --- cuentas ---
    filas = psql("select id||'|'||email||'|'||nombre from usuarios where email like '%-seed@example.com' order by email")
    cuentas = {f.split("|")[1]: f.split("|")[0] for f in filas.strip().splitlines()}
    vendedores = {e: i for e, i in cuentas.items() if e in ORDENES_POR_VENDEDOR}
    if len(vendedores) != len(ORDENES_POR_VENDEDOR):
        sys.exit("Faltan cuentas vendedoras de la seed en Postgres (restaura la seed primero: scripts/restaurar-seed.sh).")

    # compradores: se crean copiando el hash de una vendedora (misma contrasena)
    plantilla = vendedores["profix-seed@example.com"]
    ids_comp = {}
    for nombre, email, _tel, _dir in COMPRADORES:
        if email in cuentas:
            ids_comp[email] = cuentas[email]
        else:
            nuevo = str(uuid.UUID(int=rng.getrandbits(128), version=4))
            psql(
                'insert into usuarios (id, nombre, email, "passwordHash", rol, "emailVerificado", "creadoEn") '
                f'select {q(nuevo)}, {q(nombre)}, {q(email)}, "passwordHash", \'comprador\', true, TIMESTAMP \'2026-10-10 15:00:00\' '
                f"from usuarios where id = {q(plantilla)}"
            )
            ids_comp[email] = nuevo
    compradores = [(n, e, t, d, ids_comp[e]) for n, e, t, d in COMPRADORES]
    lista_ids_comp = ",".join(q(c[4]) for c in compradores)

    # --- limpiar siembra anterior (idempotente) ---
    previas = psql(f'select id::text from ordenes where "compradorId" in ({lista_ids_comp})').split()
    if previas:
        devolver = psql(
            "select (it->>'productoId')||'|'||(it->>'cantidad') from ordenes, jsonb_array_elements(items) it "
            f"where \"compradorId\" in ({lista_ids_comp}) and coalesce(it->>'tipo','producto') = 'producto' and coalesce(it->>'estadoEntrega','pendiente') <> 'cancelada'"
        ).split()
        js = "".join(f"db.productos.updateOne({{_id: ObjectId('{d.split('|')[0]}')}}, {{$inc: {{stock: {d.split('|')[1]}}}}});" for d in devolver)
        lista = ",".join(f"'{o}'" for o in previas)
        mongosh(js + f"db.reservas.deleteMany({{ordenId: {{$in: [{lista}]}}}});")
        psql(f"delete from pagos where \"compradorId\" in ({lista_ids_comp}); delete from ordenes where \"compradorId\" in ({lista_ids_comp})")

    # --- productos de cada vendedor (sin imagenes) ---
    r = subprocess.run(
        ["docker", "compose", "exec", "-T", "mongo", "mongoexport", "--quiet", "--db", "catalogo", "--collection", "productos",
         "--fields", "_id,nombre,precio,tipo,stock,vendedorId,modalidadEntrega,direccionLocal,disponibilidad"],
        capture_output=True, text=True, encoding="utf-8",
    )
    productos = [json.loads(l) for l in r.stdout.splitlines() if l.strip()]
    por_vendedor = {}
    for p in productos:
        p["id"] = p["_id"]["$oid"]
        por_vendedor.setdefault(p["vendedorId"], []).append(p)

    # Variedad garantizada en las citas pasadas (no se deja al azar): completadas, no asistió y canceladas
    ciclo_pasadas = ["entregada", "entregada", "no_asistio", "entregada", "cancelada", "entregada", "cancelada"]
    contador = {"pasadas": 0, "canceladas": 0}
    ocupados = set()  # (productoId, fecha, horaInicio, cupo) de reservas activas
    stock = {p["id"]: p.get("stock", 0) for p in productos}
    sql, js_reservas, js_stock = [], [], {}

    def hex_oid():
        return "%024x" % rng.getrandbits(96)

    def elegir_cita(p, desde, hasta):
        """Fecha y horario válidos para ese servicio (según sus días, horas, duración, margen y cupos)."""
        disp = p.get("disponibilidad") or {}
        reglas = {r_["diaSemana"]: r_ for r_ in disp.get("reglas", [])}
        dur, margen, cupos = disp.get("duracionMinutos", 60), disp.get("margenMinutos", 0), disp.get("cupos", 1)
        dias = [desde + dt.timedelta(days=n) for n in range((hasta - desde).days + 1)]
        dias = [d for d in dias if ((d.weekday() + 1) % 7) in reglas and d.isoformat() not in disp.get("diasNoDisponibles", [])]
        rng.shuffle(dias)
        for d in dias:
            regla = reglas[(d.weekday() + 1) % 7]
            inicio, fin = a_min(regla["horaInicio"]), a_min(regla["horaFin"])
            horarios = []
            t = inicio
            while t + dur <= fin:
                horarios.append(t)
                t += dur + margen
            rng.shuffle(horarios)
            for h in horarios:
                for cupo in range(1, cupos + 1):
                    clave = (p["id"], d.isoformat(), de_min(h), cupo)
                    if clave not in ocupados:
                        ocupados.add(clave)
                        return d, de_min(h), de_min(h + dur), cupo
        return None

    total = 0
    for email, n_ord in ORDENES_POR_VENDEDOR.items():
        vid = vendedores[email]
        prods = [p for p in por_vendedor.get(vid, []) if p["tipo"] == "producto" and stock[p["id"]] > 2]
        servs = [p for p in por_vendedor.get(vid, []) if p["tipo"] == "servicio"]
        agendadas = 0  # cada vendedor de servicios tiene al menos una cita agendada a futuro (para que su panel tenga pendientes)
        for _ in range(n_ord):
            comprador = rng.choice(compradores)
            c_nombre, _ce, c_tel, c_dir, c_id = comprador
            es_servicio = bool(servs) and (not prods or rng.random() < (0.85 if not prods else 0.5))
            oid = str(uuid.UUID(int=rng.getrandbits(128), version=4))
            items, reservas = [], []
            pago_metodo = rng.choice(["tarjeta", "tarjeta", "paypal", "payu"])
            if es_servicio:
                p = rng.choice(servs)
                futura = agendadas == 0 or rng.random() < 0.4
                if futura:
                    creado = dt.date(2026, 10, 28) + dt.timedelta(days=rng.randint(0, 9))
                    cita = elegir_cita(p, max(creado + dt.timedelta(days=1), HOY + dt.timedelta(days=3)), HOY + dt.timedelta(days=24))
                    estado_item = "pendiente"
                else:
                    creado = dt.date(2026, 10, 14) + dt.timedelta(days=rng.randint(0, 17))
                    cita = elegir_cita(p, creado + dt.timedelta(days=1), min(creado + dt.timedelta(days=9), HOY - dt.timedelta(days=1)))
                    estado_item = ciclo_pasadas[contador["pasadas"] % len(ciclo_pasadas)]
                    contador["pasadas"] += 1
                if cita is None:
                    continue
                if estado_item == "pendiente":
                    agendadas += 1
                fecha_c, h_ini, h_fin, cupo = cita
                efectivo = rng.random() < 0.4
                if estado_item == "cancelada":  # una cancelada con reembolso (pagó antes) y otra en efectivo, alternadas
                    efectivo = contador["canceladas"] % 2 == 1
                    contador["canceladas"] += 1
                rid = hex_oid()
                precio = p["precio"]
                cancelada = estado_item == "cancelada"
                if cancelada:  # la reserva queda cancelada y el cupo vuelve a quedar libre
                    ocupados.discard((p["id"], fecha_c.isoformat(), h_ini, cupo))
                item = {
                    "productoId": p["id"], "vendedorId": vid, "nombre": p["nombre"], "precio": precio, "cantidad": 1, "subtotal": precio,
                    "tipo": "servicio", "modalidadEntrega": p.get("modalidadEntrega"),
                    "cita": {"reservaId": rid, "fecha": fecha_c.isoformat(), "horaInicio": h_ini, "horaFin": h_fin},
                    "estadoEntrega": estado_item,
                }
                if cancelada:
                    item["canceladaEn"] = a_utc(creado + dt.timedelta(days=1), dt.time(10, 5)).isoformat() + "Z"
                    if not efectivo:
                        item["reembolso"] = precio
                items.append(item)
                if estado_item == "entregada":
                    estado_pago = "pagada"
                elif cancelada:
                    estado_pago = "cancelada" if efectivo else "reembolsada"
                else:
                    estado_pago = "por_cobrar" if efectivo else "pagada"
                pagado_con_pasarela = (not efectivo) and estado_pago in ("pagada", "reembolsada")
                if p.get("modalidadEntrega") == "local_vendedor":
                    direccion = {"nombre": c_nombre, "telefono": c_tel, "direccion": "Cita en el local del vendedor" + (f": {p['direccionLocal']}" if p.get("direccionLocal") else "")}
                else:
                    direccion = {"nombre": c_nombre, "telefono": c_tel, "direccion": c_dir}
                reservas.append({
                    "_id": rid, "productoId": p["id"], "vendedorId": vid, "compradorId": c_id, "fecha": fecha_c.isoformat(), "horaInicio": h_ini,
                    "horaFin": h_fin, "cupo": cupo, "estado": "cancelada" if cancelada else "confirmada", "ordenId": oid,
                    "recordatorioEnviado": estado_item != "pendiente",
                })
                estado_orden = estado_item
            else:
                n_items = rng.choice([1, 1, 2])
                elegidos = rng.sample(prods, min(n_items, len(prods)))
                creado = dt.date(2026, 10, 12) + dt.timedelta(days=rng.randint(0, 24))
                for p in elegidos:
                    cant = min(rng.choice([1, 1, 1, 2, 3]), stock[p["id"]] - 1)
                    if cant < 1:
                        continue
                    stock[p["id"]] -= cant
                    js_stock[p["id"]] = js_stock.get(p["id"], 0) + cant
                    items.append({
                        "productoId": p["id"], "vendedorId": vid, "nombre": p["nombre"], "precio": p["precio"], "cantidad": cant,
                        "subtotal": round(p["precio"] * cant, 2), "tipo": "producto",
                    })
                if not items:
                    continue
                antig = (HOY - creado).days
                estado_orden = "entregada" if antig > 12 else rng.choice(["entregada", "en_camino", "pendiente", "pendiente"]) if antig > 4 else rng.choice(["en_camino", "pendiente", "pendiente"])
                for it in items:
                    it["estadoEntrega"] = estado_orden
                estado_pago, pagado_con_pasarela = "pagada", True
                direccion = {"nombre": c_nombre, "telefono": c_tel, "direccion": c_dir}

            subtotal = round(sum(i["subtotal"] for i in items), 2)
            creado_dt = a_utc(creado, dt.time(rng.randint(8, 19), rng.randint(0, 59), rng.randint(0, 59)))
            sql.append(
                'insert into ordenes (id, "compradorId", items, direccion, subtotal, envio, total, "estadoPago", "estadoEntrega", "creadoEn") values '
                f"({q(oid)}, {q(c_id)}, {q(json.dumps(items, ensure_ascii=False))}::jsonb, {q(json.dumps(direccion, ensure_ascii=False))}::jsonb, "
                f"{subtotal}, 0, {subtotal}, {q(estado_pago)}, {q(estado_orden)}, {q(creado_dt.isoformat(sep=' '))});"
            )
            if pagado_con_pasarela:
                ult4 = "4242" if pago_metodo == "tarjeta" else None
                ref = None if pago_metodo == "tarjeta" else f"SEED-{pago_metodo.upper()}-{oid[:8].upper()}"
                pago_dt = creado_dt + dt.timedelta(seconds=rng.randint(3, 40))
                sql.append(
                    'insert into pagos (id, "ordenId", "compradorId", monto, metodo, estado, "tarjetaUltimos4", "referenciaExterna", "creadoEn") values '
                    f"({q(str(uuid.UUID(int=rng.getrandbits(128), version=4)))}, {q(oid)}, {q(c_id)}, {subtotal}, {q(pago_metodo)}, 'aprobado', "
                    f"{q(ult4) if ult4 else 'null'}, {q(ref) if ref else 'null'}, {q(pago_dt.isoformat(sep=' '))});"
                )
            js_reservas.extend(reservas)
            total += 1

    psql(None, entrada="\n".join(sql))
    js = ""
    for r_ in js_reservas:
        d = dict(r_)
        d.pop("_id")
        js += f"db.reservas.insertOne(Object.assign({json.dumps(d)}, {{_id: ObjectId('{r_['_id']}'), creadoEn: new Date()}}));"
    for pid, cant in js_stock.items():
        js += f"db.productos.updateOne({{_id: ObjectId('{pid}')}}, {{$inc: {{stock: -{cant}}}}});"
    mongosh(js)
    print(f"Listo: {total} ordenes ficticias, {sum(1 for s in sql if s.startswith('insert into pagos'))} pagos, {len(js_reservas)} reservas de citas, "
          f"stock descontado en {len(js_stock)} productos.")


if __name__ == "__main__":
    main()
