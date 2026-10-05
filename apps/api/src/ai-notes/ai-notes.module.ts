import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AiNotesController } from './ai-notes.controller';
import { AiNotesService } from './ai-notes.service';
import { GeminiService } from './gemini.service';

@Module({
  imports: [AuthModule],
  controllers: [AiNotesController],
  providers: [AiNotesService, GeminiService],
})
export class AiNotesModule {}
