import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards, UsePipes } from '@nestjs/common';
import { NotesTemplatesService } from './notes-templates.service';
import { HospitalContextGuard } from '../auth/guards/hospital-context.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentHospitalUser } from '../auth/decorators/current-user.decorator';
import type { HospitalUserProfile } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { createNotesTemplateSchema, updateNotesTemplateSchema } from '../common/validation/schemas';

// Doctors manage their own templates; admins manage the hospital-wide ones.
// Ownership is checked per template in the service.
@Controller('hospitals/:id/notes-templates')
@UseGuards(HospitalContextGuard)
@Roles('admin', 'doctor')
export class NotesTemplatesController {
  constructor(private readonly notesTemplatesService: NotesTemplatesService) {}

  @Get()
  list(
    @Param('id') hospitalId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
  ) {
    return this.notesTemplatesService.listItems(hospitalId, userProfile);
  }

  @Post()
  @UsePipes(new ZodValidationPipe(createNotesTemplateSchema))
  create(
    @Param('id') hospitalId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: any,
  ) {
    return this.notesTemplatesService.createItem(hospitalId, userProfile, body);
  }

  @Put(':templateId')
  @UsePipes(new ZodValidationPipe(updateNotesTemplateSchema))
  update(
    @Param('id') hospitalId: string,
    @Param('templateId') templateId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: any,
  ) {
    return this.notesTemplatesService.updateItem(hospitalId, templateId, userProfile, body);
  }

  @Delete(':templateId')
  remove(
    @Param('id') hospitalId: string,
    @Param('templateId') templateId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
  ) {
    return this.notesTemplatesService.removeItem(hospitalId, templateId, userProfile);
  }
}
