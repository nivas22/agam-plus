import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards, UsePipes } from '@nestjs/common';
import { TeamService } from './team.service';
import { HospitalContextGuard } from '../auth/guards/hospital-context.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentHospitalUser } from '../auth/decorators/current-user.decorator';
import type { HospitalUserProfile } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  createTeamMemberSchema,
  updateTeamMemberSchema,
  teamMemberStatusSchema,
  setPinSchema,
  verifyPinSchema,
} from '../common/validation/schemas';

@Controller('hospitals/:id/team')
@UseGuards(HospitalContextGuard)
@Roles('admin')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get()
  list(@Param('id') hospitalId: string) {
    return this.teamService.listMembers(hospitalId);
  }

  @Post()
  @UsePipes(new ZodValidationPipe(createTeamMemberSchema))
  create(
    @Param('id') hospitalId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: Record<string, any>,
  ) {
    return this.teamService.createTeamMember(hospitalId, userProfile, body as any);
  }

  // Declared ahead of the ':memberId' routes below so 'me' isn't captured as a member id.
  @Post('me/pin')
  @Roles('admin', 'doctor', 'front_desk', 'nurse', 'accountant')
  @UsePipes(new ZodValidationPipe(setPinSchema))
  setOwnPin(
    @Param('id') hospitalId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: { pin: string },
  ) {
    return this.teamService.setOwnPin(hospitalId, userProfile, body.pin);
  }

  @Post('me/pin/verify')
  @Roles('admin', 'doctor', 'front_desk', 'nurse', 'accountant')
  @UsePipes(new ZodValidationPipe(verifyPinSchema))
  async verifyOwnPin(@CurrentHospitalUser() userProfile: HospitalUserProfile, @Body() body: { pin: string }) {
    const valid = await this.teamService.verifyOwnPin(userProfile, body.pin);
    return { valid };
  }

  @Get(':memberId')
  getOne(@Param('id') hospitalId: string, @Param('memberId') memberId: string) {
    return this.teamService.getMemberProfile(hospitalId, memberId);
  }

  @Put(':memberId')
  @UsePipes(new ZodValidationPipe(updateTeamMemberSchema))
  update(
    @Param('id') hospitalId: string,
    @Param('memberId') memberId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: Record<string, any>,
  ) {
    return this.teamService.updateMember(hospitalId, memberId, body, userProfile);
  }

  @Patch(':memberId/status')
  @UsePipes(new ZodValidationPipe(teamMemberStatusSchema))
  updateStatus(
    @Param('id') hospitalId: string,
    @Param('memberId') memberId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: { status: 'active' | 'suspended' | 'deactivated' },
  ) {
    return this.teamService.updateStatus(hospitalId, memberId, body.status, userProfile);
  }

  @Post(':memberId/pin/reset')
  resetPin(
    @Param('id') hospitalId: string,
    @Param('memberId') memberId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
  ) {
    return this.teamService.resetPin(hospitalId, memberId, userProfile);
  }
}
