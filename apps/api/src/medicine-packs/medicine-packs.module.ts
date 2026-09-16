import { Module } from '@nestjs/common';
import { MedicinePacksController } from './medicine-packs.controller';
import { MedicinePacksService } from './medicine-packs.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [MedicinePacksController],
  providers: [MedicinePacksService],
  exports: [MedicinePacksService],
})
export class MedicinePacksModule {}
