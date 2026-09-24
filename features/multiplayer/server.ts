import { prisma } from '../../lib/database/client';
import { createMultiplayerHttp } from './http';

// Set APP_ORIGIN to the public HTTPS origin when deploying behind a proxy.
export const multiplayerHttp = createMultiplayerHttp(prisma, process.env.APP_ORIGIN);
