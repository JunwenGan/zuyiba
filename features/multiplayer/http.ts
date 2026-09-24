import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { PrismaClient } from '../../lib/generated/prisma/client';
import { createGuestSessions, GUEST_COOKIE, GUEST_SESSION_SECONDS } from './guest-session';
import { createRoomRepository } from './room-repository';
import { RoomError } from './room-error';

const emptyBody = z.object({}).strict();
const readyBody = z.object({ isReady: z.boolean() }).strict();
const statuses = { INVALID_INPUT: 400, NOT_FOUND: 404, FORBIDDEN: 403, CONFLICT: 409 };

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function failure(code: string, message: string, status: number) {
  return json({ success: false, error: { code, message } }, status);
}

// Dependency injection lets integration tests use their own temporary database.
export function createMultiplayerHttp(db: PrismaClient, configuredOrigin?: string) {
  const sessions = createGuestSessions(db);
  const rooms = createRoomRepository(db);

  function origin(request: NextRequest) {
    if (configuredOrigin) return new URL(configuredOrigin).origin;
    // NextURL normalizes loopback addresses to localhost. Host preserves the
    // browser's actual origin. Behind a proxy use the configured public origin;
    // do not trust arbitrary X-Forwarded-* values here.
    const url = new URL(request.url);
    const host = request.headers.get('host');
    return host ? new URL(`${url.protocol}//${host}`).origin : url.origin;
  }

  async function body<T>(request: NextRequest, schema: z.ZodType<T>): Promise<T> {
    // Reject cross-site writes, including requests with missing/null Origin.
    if (request.headers.get('origin') !== origin(request)) {
      throw new RoomError('FORBIDDEN', 'A same-origin request is required');
    }
    if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
      throw new RoomError('INVALID_INPUT', 'Content-Type must be application/json');
    }
    const reader = request.body?.getReader();
    if (!reader) throw new RoomError('INVALID_INPUT', 'A JSON body is required');
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 1024) {
          await reader.cancel();
          throw new RoomError('INVALID_INPUT', 'Request body is too large');
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    let input: unknown;
    try {
      input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      throw new RoomError('INVALID_INPUT', 'Invalid JSON');
    }
    const parsed = schema.safeParse(input);
    if (!parsed.success) throw new RoomError('INVALID_INPUT', 'Invalid request fields');
    return parsed.data;
  }

  async function handle(work: () => Promise<NextResponse>) {
    try {
      return await work();
    } catch (error) {
      if (error instanceof RoomError)
        return failure(error.code, error.message, statuses[error.code]);
      // Do not expose database details or credentials in the HTTP response.
      console.error('Multiplayer request failed');
      return failure('INTERNAL_ERROR', 'An unexpected error occurred', 500);
    }
  }

  const identify = (request: NextRequest) =>
    sessions.find(request.cookies.get(GUEST_COOKIE)?.value);
  const unauthorized = () =>
    failure('UNAUTHORIZED', 'Create or renew your guest session first', 401);

  return {
    session: (request: NextRequest) =>
      handle(async () => {
        await body(request, emptyBody);
        const existing = await identify(request);
        if (existing) return json({ success: true, data: { participantId: existing.id } });
        const session = await sessions.create();
        const response = json({ success: true, data: { participantId: session.id } }, 201);
        response.cookies.set(GUEST_COOKIE, session.token, {
          httpOnly: true,
          secure: new URL(origin(request)).protocol === 'https:',
          sameSite: 'lax',
          path: '/',
          maxAge: GUEST_SESSION_SECONDS,
        });
        return response;
      }),
    create: (request: NextRequest) =>
      handle(async () => {
        await body(request, emptyBody);
        const session = await identify(request);
        if (!session) return unauthorized();
        return json({ success: true, data: await rooms.create(session.id) }, 201);
      }),
    read: (request: NextRequest, roomId: string) =>
      handle(async () => {
        const session = await identify(request);
        if (!session) return unauthorized();
        const room = await rooms.find(roomId);
        // Do not disclose room participants to nonmembers.
        if (!room || !room.participants.some((p) => p.id === session.id)) {
          throw new RoomError('NOT_FOUND', 'Room not found');
        }
        return json({ success: true, data: room });
      }),
    join: (request: NextRequest, roomId: string) =>
      handle(async () => {
        await body(request, emptyBody);
        const session = await identify(request);
        if (!session) return unauthorized();
        return json({ success: true, data: await rooms.join(roomId, session.id) });
      }),
    ready: (request: NextRequest, roomId: string) =>
      handle(async () => {
        const { isReady } = await body(request, readyBody);
        const session = await identify(request);
        if (!session) return unauthorized();
        return json({ success: true, data: await rooms.ready(roomId, session.id, isReady) });
      }),
  };
}
