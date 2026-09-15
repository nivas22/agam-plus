import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './auth/decorators/public.decorator';
import { getVersion as readVersion, type VersionInfo } from './version/version';

interface HealthStatus {
  status: 'ok' | 'error';
  timestamp: string;
  version: VersionInfo;
}

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // Carries the build so an uptime check's response also answers "which
  // deploy answered this?" — the usual follow-up when health is green but
  // behaviour is wrong.
  @Public()
  @Get('health')
  getHealth(): HealthStatus {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: readVersion(),
    };
  }

  @Public()
  @Get('version')
  getVersion(): VersionInfo {
    return readVersion();
  }
}
