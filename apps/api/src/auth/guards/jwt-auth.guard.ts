import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SessionRepository } from '../../repositories/session.repository';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    private readonly sessionRepository: SessionRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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

    let payload: {
      uid: string;
      userId: string;
      email: string;
      name: string;
      sid?: string;
      scope?: string;
    };
    try {
      payload = jwt.verify(token, this.config.get<string>('JWT_SECRET')!) as typeof payload;
    } catch {
      throw new UnauthorizedException('Unauthorized');
    }

    // Patient-app tokens share JWT_SECRET with staff tokens but carry
    // scope:'patient' and no staff `userId` — reject them here so a patient
    // token can never be used against a staff/admin route, symmetric to
    // PatientAuthGuard requiring scope:'patient'.
    if (payload.scope === 'patient') {
      throw new UnauthorizedException('Unauthorized');
    }

    // Older tokens signed before session tracking was added carry no `sid` —
    // let them through unchecked rather than force-logging out everyone.
    if (payload.sid) {
      const session = await this.sessionRepository.getById(payload.sid);
      if (!session || (session as any).revokedAt) {
        throw new UnauthorizedException('Session expired — please sign in again');
      }
      this.sessionRepository.touchIfStale(payload.sid).catch(() => {});
    }

    request.user = payload;
    return true;
  }
}
