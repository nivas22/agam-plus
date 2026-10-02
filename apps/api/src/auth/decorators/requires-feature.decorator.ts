import { SetMetadata } from '@nestjs/common';
import { SUBSCRIPTION_FEATURE } from '../../constants';

export const REQUIRES_FEATURE_KEY = 'requiresFeature';
export const RequiresFeature = (feature: SUBSCRIPTION_FEATURE) => SetMetadata(REQUIRES_FEATURE_KEY, feature);
