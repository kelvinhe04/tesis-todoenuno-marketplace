import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

// Un id que no es UUID hace fallar la consulta en Postgres (codigo 22P02): se responde 400, no 500.
@Catch(QueryFailedError)
export class IdInvalidoFilter implements ExceptionFilter {
  private readonly logger = new Logger('IdInvalidoFilter');

  catch(exception: QueryFailedError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    if ((exception as any).driverError?.code === '22P02') {
      return res.status(400).json({ statusCode: 400, message: 'Identificador inválido', error: 'Bad Request' });
    }
    this.logger.error(exception.message);
    return res.status(500).json({ statusCode: 500, message: 'Internal server error' });
  }
}
