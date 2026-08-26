import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface PatientAccountContext {
  id: string;
  phone: string;
}

export const CurrentPatientAccount = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PatientAccountContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.patientAccount;
  },
);
