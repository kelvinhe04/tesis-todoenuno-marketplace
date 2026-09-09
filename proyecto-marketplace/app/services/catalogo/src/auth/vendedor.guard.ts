import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

// Se usa despues de JwtAuthGuard (necesita request.usuario ya presente).
@Injectable()
export class VendedorGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (request.usuario?.rol !== 'vendedor') {
      throw new ForbiddenException('Solo un vendedor puede realizar esta acción');
    }
    return true;
  }
}
