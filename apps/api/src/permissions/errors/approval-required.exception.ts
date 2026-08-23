import { HttpException, HttpStatus } from '@nestjs/common';

// Caught generically by the app's global ApiExceptionFilter (any HttpException
// has its getResponse() object spread into { error, details, timestamp }) —
// no dedicated exception filter needed. 202 signals "accepted, not executed".
export class ApprovalRequiredException extends HttpException {
  constructor(approvalId: string, action: string) {
    super(
      {
        message: 'This action needs approval from an admin',
        details: { requiresApproval: true, approvalId, action },
      },
      HttpStatus.ACCEPTED,
    );
  }
}
