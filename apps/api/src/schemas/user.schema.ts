import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DB_COLLECTIONS } from '@agam-plus/shared';

export type UserDocument = HydratedDocument<User>;

@Schema({ collection: DB_COLLECTIONS.USERS, strict: false, timestamps: false })
export class User {
  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  email: string;

  @Prop({ index: true, sparse: true, unique: true })
  firebaseUid?: string;

  @Prop()
  name?: string;

  @Prop()
  authProvider?: string;

  @Prop()
  lastHospitalId?: string;

  @Prop()
  lastLogin?: Date;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
