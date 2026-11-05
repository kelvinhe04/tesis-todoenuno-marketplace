import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Error as MongooseError } from 'mongoose';

// Un id que no es un ObjectId valido hace fallar el cast de Mongoose: se responde 400, no 500.
@Catch(MongooseError.CastError)
export class IdInvalidoFilter implements ExceptionFilter {
  catch(_exception: MongooseError.CastError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    return res.status(400).json({ statusCode: 400, message: 'Identificador inválido', error: 'Bad Request' });
  }
}
