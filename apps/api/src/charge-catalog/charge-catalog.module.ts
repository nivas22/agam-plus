import { Module } from '@nestjs/common';
import { ChargeCatalogController } from './charge-catalog.controller';
import { ChargeCatalogService } from './charge-catalog.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ChargeCatalogController],
  providers: [ChargeCatalogService],
  exports: [ChargeCatalogService],
})
export class ChargeCatalogModule {}
