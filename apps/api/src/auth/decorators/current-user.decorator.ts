import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtUser {
  uid: string;
  userId: string;
  email: string;
  name: string;
  // Session id (see Session schema) — lets JwtAuthGuard reject a token whose
  // session has been revoked (sign-out / "sign out everywhere") even though
  // the JWT signature/expiry are still valid.
  sid: string;
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): JwtUser => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});

export interface HospitalUserProfile {
  id: string;
  userId: string;
  hospitalId: string;
  name: string;
  email: string;
  specialization?: string;
  role: string;
  isOwner?: boolean;
  currentHospital: any;
  doctorProfile?: any;
}

export const CurrentHospitalUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): HospitalUserProfile => {
  const request = ctx.switchToHttp().getRequest();
  return request.userProfile;
});
