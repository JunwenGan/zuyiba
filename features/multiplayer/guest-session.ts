import { createHash, randomBytes } from 'node:crypto';
import type { PrismaClient } from '../../lib/generated/prisma/client';

export const GUEST_COOKIE = 'zuyiba_guest';
export const GUEST_SESSION_SECONDS = 30 * 24 * 60 * 60;
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

export function createGuestSessions(db: PrismaClient) {
  return {
    async find(token: string | undefined) {
      if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
      return db.guestSession.findFirst({
        where: { tokenHash: tokenHash(token), expiresAt: { gt: new Date() } },
        select: { id: true, expiresAt: true },
      });
    },
    async create() {
      const token = randomBytes(32).toString('hex');
      const session = await db.guestSession.create({
        data: {
          tokenHash: tokenHash(token),
          expiresAt: new Date(Date.now() + GUEST_SESSION_SECONDS * 1000),
        },
        select: { id: true, expiresAt: true },
      });
      // Only the cookie receives the secret token; the database stores its hash.
      return { ...session, token };
    },
  };
}
