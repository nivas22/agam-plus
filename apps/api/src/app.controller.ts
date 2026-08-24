import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './auth/decorators/public.decorator';

interface HealthStatus {
  status: 'ok' | 'error';
  timestamp: string;
}

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @Get('health')
  getHealth(): HealthStatus {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
