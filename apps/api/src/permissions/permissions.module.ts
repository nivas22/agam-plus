import { Global, Module } from '@nestjs/common';
import { PermissionsController } from './permissions.controller';
import { PermissionsService } from './permissions.service';
import { PermissionGuard } from './guards/permission.guard';
import { AuthModule } from '../auth/auth.module';

// Global so any feature module can inject PermissionsService or reference
// PermissionGuard in @UseGuards() without an explicit import — same
// convention as EmailModule/RepositoriesModule.
@Global()
@Module({
  imports: [AuthModule],
  controllers: [PermissionsController],
  providers: [PermissionsService, PermissionGuard],
  exports: [PermissionsService, PermissionGuard],
})
export class PermissionsModule {}
