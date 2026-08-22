import { Body, Controller, Get, Param, Put, UseGuards, UsePipes } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { HospitalContextGuard } from '../auth/guards/hospital-context.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentHospitalUser } from '../auth/decorators/current-user.decorator';
import type { HospitalUserProfile } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { updateRolePermissionsSchema } from '../common/validation/schemas';
import { TEAM_ASSIGNABLE_ROLES } from './permission-catalog';
import { ROLE } from '../constants';

@Controller('hospitals/:id/roles')
@UseGuards(HospitalContextGuard)
@Roles('admin')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  async listRoles(@Param('id') hospitalId: string) {
    const roles = [ROLE.ADMIN, ROLE.DOCTOR, ...TEAM_ASSIGNABLE_ROLES];
    const summaries = await Promise.all(roles.map((role) => this.permissionsService.getRoleSummary(hospitalId, role)));
    return { roles: summaries };
  }

  @Get(':role/permissions')
  getRolePermissions(@Param('id') hospitalId: string, @Param('role') role: string) {
    return this.permissionsService.getRoleSummary(hospitalId, role);
  }

  @Put(':role/permissions')
  @UsePipes(new ZodValidationPipe(updateRolePermissionsSchema))
  updateRolePermissions(
    @Param('id') hospitalId: string,
    @Param('role') role: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: { overrides: Record<string, string>; discountCapAmount?: number },
  ) {
    return this.permissionsService.updatePermissions(hospitalId, role, body, userProfile.userId);
  }
}
