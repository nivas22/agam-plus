import { ExecutionContext, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { CronSecretGuard } from './cron-secret.guard';

function contextWithAuthHeader(authorization?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization } }),
    }),
  } as unknown as ExecutionContext;
}

describe('CronSecretGuard', () => {
  it('rejects every request when CRON_SECRET is not configured (fails closed)', () => {
    const guard = new CronSecretGuard({ get: () => undefined } as any);
    expect(() => guard.canActivate(contextWithAuthHeader('Bearer anything'))).toThrow(InternalServerErrorException);
  });

  it('rejects a request with no/incorrect Authorization header', () => {
    const guard = new CronSecretGuard({ get: () => 'correct-secret' } as any);
    expect(() => guard.canActivate(contextWithAuthHeader(undefined))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(contextWithAuthHeader('Bearer wrong-secret'))).toThrow(ForbiddenException);
  });

  it('allows a request with the exact configured secret', () => {
    const guard = new CronSecretGuard({ get: () => 'correct-secret' } as any);
    expect(guard.canActivate(contextWithAuthHeader('Bearer correct-secret'))).toBe(true);
  });
});
