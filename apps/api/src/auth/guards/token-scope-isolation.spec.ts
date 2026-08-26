import * as jwt from 'jsonwebtoken';
import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PatientAuthGuard } from '../../patient-auth/guards/patient-auth.guard';
import { Reflector } from '@nestjs/core';

const JWT_SECRET = 'test-secret';
const fakeConfig = { get: (key: string) => (key === 'JWT_SECRET' ? JWT_SECRET : undefined) } as any;

function makeContext(authHeader?: string) {
  const request: any = { headers: authHeader ? { authorization: authHeader } : {} };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;
}

describe('Patient/staff token scope isolation', () => {
  const staffToken = jwt.sign(
    { uid: 'u1', userId: 'u1', email: 'staff@test.com', name: 'Staff' },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
  const patientToken = jwt.sign(
    { sub: 'acc1', phone: '9876543210', scope: 'patient' },
    JWT_SECRET,
    { expiresIn: '1h' },
  );

  it('a patient-scoped token is rejected by the staff JwtAuthGuard', () => {
    const guard = new JwtAuthGuard(new Reflector(), fakeConfig);
    expect(() => guard.canActivate(makeContext(`Bearer ${patientToken}`))).toThrow(
      UnauthorizedException,
    );
  });

  it('a staff token is accepted by the staff JwtAuthGuard', () => {
    const guard = new JwtAuthGuard(new Reflector(), fakeConfig);
    expect(guard.canActivate(makeContext(`Bearer ${staffToken}`))).toBe(true);
  });

  it('a staff token is rejected by PatientAuthGuard', () => {
    const guard = new PatientAuthGuard(fakeConfig);
    expect(() => guard.canActivate(makeContext(`Bearer ${staffToken}`))).toThrow(
      UnauthorizedException,
    );
  });

  it('a patient-scoped token is accepted by PatientAuthGuard', () => {
    const guard = new PatientAuthGuard(fakeConfig);
    expect(guard.canActivate(makeContext(`Bearer ${patientToken}`))).toBe(true);
  });
});
