import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

interface PatientJwtPayload {
  sub: string;
  phone: string;
  scope: string;
}

@Injectable()
export class PatientAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers['authorization'];

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Unauthorized');
    }

    const token = authHeader.slice('Bearer '.length);

    try {
      const payload = jwt.verify(
        token,
        this.config.get<string>('JWT_SECRET')!,
      ) as PatientJwtPayload;

      // Symmetric to JwtAuthGuard rejecting scope:'patient' — this is the
      // only isolation boundary between patient and staff tokens since both
      // share JWT_SECRET, so it must reject anything that isn't explicitly ours.
      if (payload.scope !== 'patient') {
        throw new UnauthorizedException('Unauthorized');
      }

      request.patientAccount = { id: payload.sub, phone: payload.phone };
      return true;
    } catch {
      throw new UnauthorizedException('Unauthorized');
    }
  }
}
