import { SetMetadata } from '@nestjs/common';

export const THROTTLER_NAME_KEY = 'throttlerName';

/**
 * Custom decorator to specify which throttler configuration to use
 * @param name - Name of the throttler configuration ('default' or 'auth')
 */
export const UseThrottler = (name: string) => SetMetadata(THROTTLER_NAME_KEY, name);
