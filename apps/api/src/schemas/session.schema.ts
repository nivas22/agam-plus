import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DB_COLLECTIONS } from '../constants';

export type SessionDocument = HydratedDocument<Session>;

// One row per signed-in device/browser. The session's _id is embedded in the
// JWT as `sid` so JwtAuthGuard can reject a token whose session was revoked
// (sign-out / "sign out everywhere") even though the JWT itself is still
// cryptographically valid and unexpired.
@Schema({ collection: DB_COLLECTIONS.SESSIONS, strict: false, timestamps: false })
export class Session {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop()
  userAgent?: string;

  @Prop()
  ip?: string;

  @Prop({ required: true })
  createdAt: Date;

  @Prop({ required: true })
  lastUsedAt: Date;

  @Prop()
  revokedAt?: Date;
}

export const SessionSchema = SchemaFactory.createForClass(Session);
