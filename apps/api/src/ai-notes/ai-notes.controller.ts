import { Body, Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { HospitalContextGuard } from '../auth/guards/hospital-context.guard';
import { RequiresModule } from '../auth/decorators/requires-module.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentHospitalUser } from '../auth/decorators/current-user.decorator';
import type { HospitalUserProfile } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { generateSessionNotesSchema } from '../common/validation/schemas';
import { HOSPITAL_MODULE } from '../constants';
import { AiNotesService } from './ai-notes.service';
import type { GenerateSessionNotesBody } from './ai-notes.types';

@Controller('hospitals/:id/ai-notes')
@UseGuards(HospitalContextGuard)
@Roles('admin', 'doctor')
@RequiresModule(HOSPITAL_MODULE.AI_NOTES)
export class AiNotesController {
  constructor(private readonly aiNotesService: AiNotesService) {}

  @Post('session-notes')
  @HttpCode(HttpStatus.OK)
  generateSessionNotes(
    @Param('id') hospitalId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body(new ZodValidationPipe(generateSessionNotesSchema)) body: GenerateSessionNotesBody,
  ) {
    return this.aiNotesService.generateSessionNotes(hospitalId, userProfile, body);
  }
}
