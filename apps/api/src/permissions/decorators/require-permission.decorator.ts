import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSION_KEY = 'requirePermission';
export const RequirePermission = (action: string) => SetMetadata(REQUIRE_PERMISSION_KEY, action);
