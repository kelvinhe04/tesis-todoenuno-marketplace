// Plantilla HTML de los correos de TodoEnUno. HTML "de correo": tablas y estilos en línea (los clientes de
// correo no soportan CSS externo ni flex/grid). Las fotos van como adjuntos en línea (cid:), porque Gmail
// bloquea las imágenes en data-URI.

export interface CitaCorreo {
  fecha: string; // AAAA-MM-DD
  horaInicio: string; // HH:mm
  horaFin: string;
}

export interface ItemCorreo {
  nombre: string;
  cantidad: number;
  precio: number;
  cita?: CitaCorreo;
  imagenCid?: string; // cid del adjunto en línea (sin "cid:")
}

export type TonoCorreo = 'ok' | 'error' | 'info';

export interface DatosCorreo {
  etiqueta: string; // píldora de color: "Pago aprobado", "Nueva orden"…
  tono: TonoCorreo;
  titulo: string;
  mensaje: string;
  ordenId?: string;
  items?: ItemCorreo[];
  total?: number;
  boton?: { texto: string; url: string };
}

const COLORES = {
  marca: '#1b3022',
  acento: '#2f7a4a',
  fondo: '#f4f5f0',
  borde: '#e3e5dc',
  texto: '#1a1d1a',
  suave: '#5f655e',
};

const TONOS: Record<TonoCorreo, { fondo: string; texto: string }> = {
  ok: { fondo: '#e4f2e8', texto: '#1f6b3a' },
  error: { fondo: '#fbe6e4', texto: '#a3342b' },
  info: { fondo: '#fdf0d8', texto: '#8a5a00' },
};

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const dinero = (n: number) => `$${n.toFixed(2)}`;

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function fechaLarga(fecha: string): string {
  const [a, m, d] = fecha.split('-').map(Number);
  const dia = DIAS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
  return `${dia} ${d} de ${MESES[m - 1]} de ${a}`;
}

function hora12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

function textoCita(c: CitaCorreo) {
  return `${fechaLarga(c.fecha)}, ${hora12(c.horaInicio)} – ${hora12(c.horaFin)}`;
}

function filaItem(it: ItemCorreo): string {
  const foto = it.imagenCid
    ? `<img src="cid:${esc(it.imagenCid)}" alt="" style="display:block;max-width:72px;max-height:72px;width:auto;height:auto;margin:0 auto;border:0;">`
    : '';
  const detalle = it.cita
    ? `<div style="margin-top:6px;font-size:13px;color:${COLORES.acento};font-weight:600;">📅 ${esc(textoCita(it.cita))}</div>`
    : `<div style="margin-top:4px;font-size:13px;color:${COLORES.suave};">${it.cantidad} × ${dinero(it.precio)}</div>`;
  return `<tr>
    <td width="88" style="padding:12px 0 12px 0;border-top:1px solid ${COLORES.borde};vertical-align:middle;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="76" height="76" style="width:76px;height:76px;border:1px solid ${COLORES.borde};border-radius:10px;background:#ffffff;"><tr><td align="center" valign="middle" style="width:76px;height:76px;">${foto}</td></tr></table>
    </td>
    <td style="padding:12px 0;border-top:1px solid ${COLORES.borde};vertical-align:middle;">
      <div style="font-size:15px;font-weight:700;color:${COLORES.texto};">${esc(it.nombre)}</div>${detalle}
    </td>
    <td align="right" style="padding:12px 0;border-top:1px solid ${COLORES.borde};vertical-align:middle;font-size:15px;font-weight:700;color:${COLORES.texto};white-space:nowrap;">${dinero(it.cantidad * it.precio)}</td>
  </tr>`;
}

export function htmlCorreo(d: DatosCorreo): string {
  const tono = TONOS[d.tono];
  const items = d.items?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:20px;">
        ${d.items.map(filaItem).join('')}
        ${
          d.total !== undefined
            ? `<tr><td colspan="2" style="padding:14px 0 0 0;border-top:1px solid ${COLORES.borde};font-size:14px;color:${COLORES.suave};">Total</td>
               <td align="right" style="padding:14px 0 0 0;border-top:1px solid ${COLORES.borde};font-size:18px;font-weight:800;color:${COLORES.texto};">${dinero(d.total)}</td></tr>`
            : ''
        }
      </table>`
    : '';
  const boton = d.boton
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;"><tr><td style="background:${COLORES.acento};border-radius:999px;">
        <a href="${esc(d.boton.url)}" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">${esc(d.boton.texto)}</a>
      </td></tr></table>`
    : '';
  const orden = d.ordenId ? `<div style="font-size:13px;color:${COLORES.suave};margin-top:6px;">Orden #${esc(d.ordenId.slice(0, 8))}</div>` : '';

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(d.titulo)}</title></head>
<body style="margin:0;padding:0;background:${COLORES.fondo};font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${COLORES.texto};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${COLORES.fondo};"><tr><td align="center" style="padding:28px 12px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="width:100%;max-width:560px;">
      <tr><td style="background:${COLORES.marca};border-radius:16px 16px 0 0;padding:22px 28px;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">Todo<span style="color:#7fcf9a;">En</span>Uno</td></tr>
      <tr><td style="background:#ffffff;border-radius:0 0 16px 16px;padding:28px;border:1px solid ${COLORES.borde};border-top:0;">
        <span style="display:inline-block;padding:5px 12px;border-radius:999px;background:${tono.fondo};color:${tono.texto};font-size:12px;font-weight:800;letter-spacing:0.4px;text-transform:uppercase;">${esc(d.etiqueta)}</span>
        <h1 style="margin:14px 0 0 0;font-size:22px;line-height:1.3;color:${COLORES.texto};">${esc(d.titulo)}</h1>
        ${orden}
        <p style="margin:14px 0 0 0;font-size:15px;line-height:1.6;color:${COLORES.texto};white-space:pre-line;">${esc(d.mensaje)}</p>
        ${items}
        ${boton}
      </td></tr>
      <tr><td align="center" style="padding:18px 8px;font-size:12px;line-height:1.5;color:${COLORES.suave};">Prototipo académico de TodoEnUno, trabajo de graduación, UTP.<br>Recibes este correo por una acción en tu cuenta.</td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

// Versión en texto plano (clientes sin HTML y antispam)
export function textoPlano(d: DatosCorreo): string {
  const lineas = [d.titulo, '', d.mensaje];
  if (d.ordenId) lineas.push('', `Orden #${d.ordenId.slice(0, 8)}`);
  for (const it of d.items ?? []) {
    lineas.push(`- ${it.nombre}: ${it.cita ? textoCita(it.cita) : `${it.cantidad} x ${dinero(it.precio)}`}`);
  }
  if (d.total !== undefined) lineas.push(`Total: ${dinero(d.total)}`);
  if (d.boton) lineas.push('', `${d.boton.texto}: ${d.boton.url}`);
  return lineas.join('\n');
}

// Correos sin orden (p. ej. verificación de cuenta): mismo diseño, el texto original como mensaje
// y cualquier enlace http(s) convertido en botón.
export function datosDeTextoLibre(asunto: string, texto: string): DatosCorreo {
  const enlace = texto.match(/https?:\/\/\S+/)?.[0];
  const mensaje = texto.replace(/https?:\/\/\S+/g, '').replace(/[ \t]+\n/g, '\n').trim();
  return {
    etiqueta: 'Tu cuenta',
    tono: 'info',
    titulo: asunto.replace(/^TodoEnUno\s*[—:-]\s*/i, ''),
    mensaje,
    boton: enlace ? { texto: 'Abrir enlace', url: enlace } : undefined,
  };
}
