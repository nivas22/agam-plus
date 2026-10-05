import { Module } from '@nestjs/common';
import { NotesTemplatesController } from './notes-templates.controller';
import { NotesTemplatesService } from './notes-templates.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [NotesTemplatesController],
  providers: [NotesTemplatesService],
})
export class NotesTemplatesModule {}
