import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DB_COLLECTIONS } from '../constants';

export type NotesTemplateDocument = HydratedDocument<NotesTemplate>;

// Reusable snippets a doctor drops into session notes with one click
// ("Advised rest", "Continue medication"). A template with no ownerUserId is
// hospital-wide and admin-managed; one with an ownerUserId is that doctor's
// own and only they see it.
@Schema({ collection: DB_COLLECTIONS.NOTES_TEMPLATES, strict: false, timestamps: false })
export class NotesTemplate {
  @Prop({ required: true, index: true })
  hospitalId: string;

  @Prop({ index: true })
  ownerUserId?: string;

  @Prop({ required: true })
  label: string;

  @Prop({ required: true })
  text: string;

  // Archived rather than deleted so the one-time default seeding never
  // re-runs for a hospital that cleared its list on purpose.
  @Prop({ required: true, enum: ['active', 'archived'], default: 'active', index: true })
  status: string;

  @Prop()
  createdBy?: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const NotesTemplateSchema = SchemaFactory.createForClass(NotesTemplate);
NotesTemplateSchema.index({ hospitalId: 1, status: 1, ownerUserId: 1 });
