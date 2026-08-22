import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsService } from '../permissions.service';
import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { HospitalUserProfile } from '../../auth/decorators/current-user.decorator';

// Runs after HospitalContextGuard — depends on request.userProfile being set.
// Delegates to PermissionsService.enforce(), which returns silently when
// allowed, throws 403 when blocked, or throws ApprovalRequiredException (202)
// when the action needs approval (see permissions/errors/approval-required.exception.ts).
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const action = this.reflector.getAllAndOverride<string | undefined>(REQUIRE_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!action) return true;

    const request = context.switchToHttp().getRequest();
    const userProfile: HospitalUserProfile = request.userProfile;
    const hospitalId: string | undefined = request.params?.id;

    if (!userProfile || !hospitalId) return true;

    await this.permissionsService.enforce(hospitalId, userProfile, action, {
      body: request.body,
      params: request.params,
      query: request.query,
    });
    return true;
  }
}
