import { Body, Controller, Post, UsePipes } from '@nestjs/common';
import { DemoRequestsService } from './demo-requests.service';
import { Public } from '../auth/decorators/public.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { createDemoRequestSchema } from '../common/validation/schemas';

// Public endpoint — "Book a demo" on the marketing site (apps/www) has no
// signed-in user, so this bypasses the global JwtAuthGuard via @Public().
@Controller('demo-requests')
export class DemoRequestsController {
  constructor(private readonly demoRequestsService: DemoRequestsService) {}

  @Public()
  @Post()
  @UsePipes(new ZodValidationPipe(createDemoRequestSchema))
  create(
    @Body()
    body: {
      hospitalName: string;
      contactName: string;
      phone: string;
      email?: string;
      city?: string;
      doctorCount?: number;
      message?: string;
    },
  ) {
    return this.demoRequestsService.create(body);
  }
}
