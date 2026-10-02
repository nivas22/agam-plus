import { CanActivate, ExecutionContext, ForbiddenException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Vercel Cron Jobs invoke a path on schedule and (when CRON_SECRET is set in
// the project's environment variables) automatically send
// `Authorization: Bearer <CRON_SECRET>` — this guard is the only thing
// standing between that endpoint and the public internet, since the route
// itself is @Public() (bypasses the normal JWT auth).
@Injectable()
export class CronSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = this.config.get<string>('CRON_SECRET');
    if (!secret) {
      // Fail closed — an unconfigured secret must never be treated as "no
      // auth required".
      throw new InternalServerErrorException('CRON_SECRET is not configured');
    }

    const request = context.switchToHttp().getRequest();
    const header = request.headers?.authorization;
    if (header !== `Bearer ${secret}`) {
      throw new ForbiddenException('Invalid cron secret');
    }

    return true;
  }
}
