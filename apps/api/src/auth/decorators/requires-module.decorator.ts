import { SetMetadata } from '@nestjs/common';
import { HOSPITAL_MODULE } from '../../constants';

export const REQUIRES_MODULE_KEY = 'requiresModule';
export const RequiresModule = (module: HOSPITAL_MODULE) => SetMetadata(REQUIRES_MODULE_KEY, module);
