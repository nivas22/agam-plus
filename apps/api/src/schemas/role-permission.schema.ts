import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DB_COLLECTIONS } from '../constants';

export type RolePermissionDocument = HydratedDocument<RolePermission>;

// One doc per (hospitalId, role) — only ever created when a hospital actually
// edits a role away from its code-defined default (see permissions/permission-catalog.ts).
// A missing doc means "use the default matrix for this role".
@Schema({
  collection: DB_COLLECTIONS.ROLE_PERMISSIONS,
  strict: false,
  timestamps: false,
})
export class RolePermission {
  @Prop({ required: true, index: true })
  hospitalId: string;

  @Prop({ required: true })
  role: string;

  // actionKey -> 'allowed' | 'needs_approval' | 'blocked', only for keys that
  // override the default — see PermissionsService.getEffectivePermissions.
  @Prop({ type: Object, default: {} })
  overrides: Record<string, string>;

  @Prop()
  discountCapAmount?: number;

  @Prop()
  updatedAt?: Date;

  @Prop()
  updatedBy?: string;
}

export const RolePermissionSchema = SchemaFactory.createForClass(RolePermission);
RolePermissionSchema.index({ hospitalId: 1, role: 1 }, { unique: true });
