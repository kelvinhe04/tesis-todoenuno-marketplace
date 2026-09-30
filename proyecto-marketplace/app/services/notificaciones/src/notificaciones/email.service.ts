import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

// Envio de correo real sobre una cuenta de prueba de Ethereal (sandbox de SMTP):
// no llega a una bandeja de entrada real, pero se envia y se recibe por SMTP de
// verdad; el enlace de vista previa queda en el log del servicio. Conforme al
// alcance del anteproyecto (seccion 1.3), no se integra un proveedor de correo
// de produccion.
@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  async onModuleInit() {
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

  async enviar(destinatario: string, asunto: string, texto: string) {
    if (!this.transporter) {
      this.logger.warn(`Transporter de correo no disponible; se omite el envío a ${destinatario}`);
      return;
    }
    const info = await this.transporter.sendMail({
      from: '"TodoEnUno" <no-responder@todoenuno.test>',
      to: destinatario,
      subject: asunto,
      text: texto,
    });
    this.logger.log(`Correo enviado a ${destinatario} — vista previa: ${nodemailer.getTestMessageUrl(info)}`);
  }
}
