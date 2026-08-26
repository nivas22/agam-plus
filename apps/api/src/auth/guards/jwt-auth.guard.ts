import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers['authorization'];

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Unauthorized');
    }

    const token = authHeader.slice('Bearer '.length);

    try {
      const payload = jwt.verify(token, this.config.get<string>('JWT_SECRET')!) as {
        uid: string;
        userId: string;
        email: string;
        name: string;
        scope?: string;
      };

      // Patient-app tokens share JWT_SECRET with staff tokens but carry
      // scope:'patient' and no staff `userId` — reject them here so a patient
      // token can never be used against a staff/admin route, symmetric to
      // PatientAuthGuard requiring scope:'patient'.
      if (payload.scope === 'patient') {
        throw new UnauthorizedException('Unauthorized');
      }

      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Unauthorized');
    }
  }
}
