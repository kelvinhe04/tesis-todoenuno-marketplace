// Audita y corrige el catálogo (Mongo) para que cumpla las reglas actuales. Lo ejecuta
// normalizar-catalogo.sh, que antepone las constantes MODO, NOMBRES y (opcional) BD_FOTOS.
//   MODO = 'auditar' (solo informa) | 'aplicar' (corrige)
//   NOMBRES = { idVendedor: 'Nombre' }        -> proveedor por defecto de los servicios que no lo tienen
//   BD_FOTOS = 'catalogo_respaldo' | null      -> base temporal con un respaldo, para recuperar fotos faltantes
//
// Reglas (las mismas que valida el servicio catalogo al crear/editar):
//  - categoría acorde al tipo: producto = Electrónica|Hogar|Moda|Belleza ; servicio = Servicios profesionales|Belleza
//  - stock entero y precio con máximo 2 decimales
//  - servicio: con proveedor, modalidad, días/horarios válidos (HH:mm, fin > inicio, cabe una cita,
//    duración 15-480) y, si es en el local, con dirección y ubicación
//  - toda publicación con al menos 1 foto
const CAT_PRODUCTO = ['Electrónica', 'Hogar', 'Moda', 'Belleza'];
const CAT_SERVICIO = ['Servicios profesionales', 'Belleza'];
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const aMin = (h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
const REGLA_POR_DEFECTO = (dia) => ({ diaSemana: dia, horaInicio: '09:00', horaFin: '17:00' });

let publicacionesConCambios = 0;
let totalCambios = 0;

db.productos.find({}, { imagenes: 0 }).forEach((p) => {
  const cambios = {};
  const notas = [];
  const esServicio = p.tipo === 'servicio';

  // --- categoría
  const validas = esServicio ? CAT_SERVICIO : CAT_PRODUCTO;
  if (!validas.includes(p.categoria)) {
    const nueva = esServicio ? 'Servicios profesionales' : 'Hogar';
    notas.push(`categoría "${p.categoria}" -> "${nueva}"`);
    cambios.categoria = nueva;
  }

  // --- números
  if (!esServicio && !Number.isInteger(p.stock)) {
    const nuevo = Math.max(0, Math.round(Number(p.stock) || 0));
    notas.push(`stock ${p.stock} -> ${nuevo}`);
    cambios.stock = nuevo;
  }
  if (Math.round(p.precio * 100) / 100 !== p.precio) {
    const nuevo = Math.round(p.precio * 100) / 100;
    notas.push(`precio ${p.precio} -> ${nuevo}`);
    cambios.precio = nuevo;
  }
  if (p.pausada === undefined) cambios.pausada = false;

  // --- servicios
  if (esServicio) {
    if (!p.marca || !String(p.marca).trim()) {
      const proveedor = NOMBRES[p.vendedorId] || 'Proveedor independiente';
      notas.push(`proveedor vacío -> "${proveedor}"`);
      cambios.marca = proveedor;
    }
    if (!p.modalidadEntrega) {
      notas.push('modalidad vacía -> domicilio_cliente');
      cambios.modalidadEntrega = 'domicilio_cliente';
    }
    // disponibilidad
    let d = p.disponibilidad;
    let tocada = false;
    if (!d || !Array.isArray(d.reglas) || !d.reglas.length) {
      d = { duracionMinutos: (d && d.duracionMinutos) || 60, reglas: [1, 2, 3, 4, 5].map(REGLA_POR_DEFECTO), diasNoDisponibles: [] };
      notas.push('sin disponibilidad -> lunes a viernes 09:00-17:00 (citas de ' + d.duracionMinutos + ' min)');
      tocada = true;
    } else {
      d = JSON.parse(JSON.stringify(d));
      if (!(d.duracionMinutos >= 15 && d.duracionMinutos <= 480)) {
        notas.push(`duración ${d.duracionMinutos} -> 60`);
        d.duracionMinutos = 60;
        tocada = true;
      }
      d.reglas = d.reglas.map((r) => {
        const mal = !HORA.test(r.horaInicio || '') || !HORA.test(r.horaFin || '') || aMin(r.horaFin) - aMin(r.horaInicio) < d.duracionMinutos;
        if (!mal) return r;
        notas.push(`horario ${r.horaInicio}-${r.horaFin} (día ${r.diaSemana}) -> 09:00-17:00`);
        tocada = true;
        return { diaSemana: r.diaSemana, horaInicio: '09:00', horaFin: '17:00' };
      });
      if (!Array.isArray(d.diasNoDisponibles)) {
        d.diasNoDisponibles = [];
        tocada = true;
      }
    }
    if (tocada) cambios.disponibilidad = d;

    // local del vendedor: necesita dirección y ubicación
    const modalidad = cambios.modalidadEntrega || p.modalidadEntrega;
    if (modalidad === 'local_vendedor') {
      if (!p.ubicacion) {
        notas.push('en local sin ubicación (no se puede inventar) -> pasa a "a domicilio del cliente"');
        cambios.modalidadEntrega = 'domicilio_cliente';
      } else if (!p.direccionLocal || !String(p.direccionLocal).trim()) {
        notas.push('en local sin dirección -> "Ubicación indicada en el mapa"');
        cambios.direccionLocal = 'Ubicación indicada en el mapa';
      }
    }
  }

  // --- fotos
  const doc = db.productos.findOne({ _id: p._id }, { imagenes: 1, imagenUrl: 1 });
  const tieneFoto = (doc.imagenes && doc.imagenes.length) || doc.imagenUrl;
  if (!tieneFoto) {
    let recuperada = false;
    if (BD_FOTOS) {
      const antes = db.getSiblingDB(BD_FOTOS).productos.findOne({ _id: p._id }, { imagenes: 1, imagenUrl: 1 });
      if (antes && ((antes.imagenes && antes.imagenes.length) || antes.imagenUrl)) {
        cambios.imagenes = antes.imagenes && antes.imagenes.length ? antes.imagenes : [antes.imagenUrl];
        notas.push(`sin foto -> recuperadas ${cambios.imagenes.length} del respaldo`);
        recuperada = true;
      }
    }
    if (!recuperada) notas.push('SIN FOTO y no hay de dónde recuperarla (hay que subirla desde el panel)');
  }

  // --- textos mínimos (el formulario ya los exige)
  if (typeof p.descripcion !== 'string' || p.descripcion.length < 10) notas.push(`descripción demasiado corta: "${p.descripcion}" (editar a mano)`);

  if (notas.length) {
    publicacionesConCambios++;
    totalCambios += Object.keys(cambios).length;
    print(`- [${p.tipo}] ${p.nombre} (${p._id}):`);
    notas.forEach((n) => print('    · ' + n));
    if (MODO === 'aplicar' && Object.keys(cambios).length) db.productos.updateOne({ _id: p._id }, { $set: cambios });
  }
});

print('');
print(`${MODO === 'aplicar' ? 'CORREGIDAS' : 'CON PROBLEMAS (modo auditar, no se cambió nada)'}: ${publicacionesConCambios} de ${db.productos.countDocuments()} publicaciones.`);
