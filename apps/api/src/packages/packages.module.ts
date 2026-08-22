import { Module } from '@nestjs/common';
import { PackagesController } from './packages.controller';
import { PackagesService } from './packages.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [PackagesController],
  providers: [PackagesService],
  exports: [PackagesService],
})
export class PackagesModule {}
