import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { datosDeTextoLibre, htmlCorreo, textoPlano, type DatosCorreo } from './plantilla-correo';

export interface AdjuntoCorreo {
  filename: string;
  cid: string;
  content?: Buffer;
  contentType?: string;
  path?: string;
  // "inline": la foto se ve dentro del correo y Gmail no la lista como archivo adjunto
  contentDisposition?: 'inline' | 'attachment';
}

// Envio de correo por SMTP. Con SMTP_HOST configurado (en app/.env) el correo sale por ese servidor
// y llega a la bandeja real del destinatario; sin SMTP_HOST se usa una cuenta de prueba de Ethereal
// (sandbox de SMTP: se envia por SMTP de verdad pero no llega a ninguna bandeja; el enlace de vista
// previa queda en el log). Conforme al alcance del anteproyecto (seccion 1.3) el modo por defecto es el sandbox.
@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private remitente = '"TodoEnUno" <no-responder@todoenuno.test>';
  private real = false;

  async onModuleInit() {
    const host = process.env.SMTP_HOST?.trim();
    if (host) {
      const puerto = Number(process.env.SMTP_PORT) || 587;
      this.transporter = nodemailer.createTransport({
        host,
        port: puerto,
        secure: puerto === 465,
        // Google muestra la contraseña de aplicación en grupos separados por espacios: se ignoran
        auth: { user: process.env.SMTP_USER?.trim(), pass: (process.env.SMTP_PASS ?? '').replace(/\s/g, '') },
      });
      this.remitente = process.env.SMTP_FROM?.trim() || `"TodoEnUno" <${process.env.SMTP_USER}>`;
      this.real = true;
      try {
        await this.transporter.verify();
        this.logger.log(`Correo REAL por SMTP (${host}:${puerto}) como ${this.remitente}`);
      } catch (err) {
        this.logger.warn(`SMTP configurado pero no responde (${host}): ${err}. Los envíos fallarán.`);
      }
      return;
    }
    try {
      const cuentaPrueba = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransport({
        host: cuentaPrueba.smtp.host,
        port: cuentaPrueba.smtp.port,
        secure: cuentaPrueba.smtp.secure,
        auth: { user: cuentaPrueba.user, pass: cuentaPrueba.pass },
      });
      this.logger.log(`Cuenta de correo de prueba (Ethereal) lista: ${cuentaPrueba.user}`);
    } catch (err) {
      this.logger.warn(`No se pudo crear la cuenta de correo de prueba; los envíos se omitirán: ${err}`);
    }
  }

  // Con "datos" se arma el correo con la plantilla (HTML + texto plano + fotos en línea); sin ellos el
  // texto se envuelve en la misma plantilla (p. ej. el correo de verificación de cuenta).
  async enviar(destinatario: string, asunto: string, texto: string, datos?: DatosCorreo, adjuntos: AdjuntoCorreo[] = []) {
    if (!this.transporter) {
      this.logger.warn(`Transporter de correo no disponible; se omite el envío a ${destinatario}`);
      return;
    }
    const plantilla = datos ?? datosDeTextoLibre(asunto, texto);
    const info = await this.transporter.sendMail({
      from: this.remitente,
      to: destinatario,
      subject: asunto,
      text: datos ? textoPlano(datos) : texto,
      html: htmlCorreo(plantilla),
      attachments: adjuntos,
    });
    this.logger.log(
      this.real
        ? `Correo enviado a ${destinatario} (SMTP real)`
        : `Correo enviado a ${destinatario}. Vista previa: ${nodemailer.getTestMessageUrl(info)}`,
    );
  }
}
