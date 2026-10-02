import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import type { PrismaClient } from '../../lib/generated/prisma/client';
import { createGuestSessions, GUEST_COOKIE } from './guest-session';
import { createMatchRepository } from './match-repository';
import { roomEvents } from './room-events';
import { createMatchLifecycle } from './match-lifecycle';

export function attachRoomSockets(server: HttpServer, db: PrismaClient, publicOrigin?: string) {
  const sessions = createGuestSessions(db);
  const matches = createMatchRepository(db);
  const lifecycle = createMatchLifecycle(db);
  const io = new Server(server, {
    transports: ['websocket'],
    maxHttpBufferSize: 1024,
    pingInterval: 5000,
    pingTimeout: 5000,
    allowRequest(request, done) {
      // Browser WebSocket handshakes include Origin. No wildcard cross-site access.
      const expected = publicOrigin ?? `http://${request.headers.host}`;
      done(null, request.headers.origin === expected);
    },
  });
  let closing = false;
  let queue: Promise<unknown> = Promise.resolve();
  const enqueue = (work: () => Promise<void>) => {
    const result = queue.then(work);
    queue = result.catch(() => console.error('Multiplayer presence update failed'));
    return result;
  };
  const online = (roomId: string) =>
    new Set(
      [...io.sockets.sockets.values()]
        .filter((s) => s.connected && s.data.roomId === roomId)
        .map((s) => s.data.participantId as string)
    );
  const presence = (roomId: string) =>
    io.to(`room:${roomId}`).emit('room:presence', [...online(roomId)]);
  const reconcile = async (roomId: string) => {
    if (await lifecycle.reconcile(roomId, online(roomId))) roomEvents.emit('changed', roomId);
  };
  let sweeping = false;
  const sweep = setInterval(() => {
    if (closing || sweeping) return;
    sweeping = true;
    void enqueue(async () => {
      const rooms = await db.matchRoom.findMany({
        where: { status: 'PLAYING' },
        select: { id: true },
      });
      for (const room of rooms) await reconcile(room.id);
    })
      .catch(() => {})
      .finally(() => {
        sweeping = false;
      });
  }, 1000);
  sweep.unref();
  io.use(async (socket, next) => {
    try {
      const token = socket.request.headers.cookie
        ?.split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${GUEST_COOKIE}=`))
        ?.slice(GUEST_COOKIE.length + 1);
      const session = await sessions.find(token);
      const roomId: unknown = socket.handshake.auth.roomId;
      if (!session || typeof roomId !== 'string' || roomId.length > 128) throw new Error();
      await matches.read(roomId, session.id); // Verify membership, not just a valid cookie.
      // Settle an elapsed grace period before allowing a late reconnect to revive it.
      await enqueue(() => reconcile(roomId));
      socket.data.roomId = roomId;
      socket.data.participantId = session.id;
      socket.data.expiresAt = session.expiresAt.getTime();
      next();
    } catch {
      next(new Error('Room connection not authorized'));
    }
  });
  io.on('connection', async (socket) => {
    await socket.join(`room:${socket.data.roomId}`);
    if (!socket.connected) return;
    socket.emit('room:changed'); // Reconnect always reloads persisted state.
    presence(socket.data.roomId);
    const expiry = setInterval(() => {
      if (Date.now() >= socket.data.expiresAt) socket.disconnect(true);
    }, 1000);
    expiry.unref();
    socket.on('disconnect', () => {
      clearInterval(expiry);
      if (closing) return;
      presence(socket.data.roomId);
      // One tab closing must not mark the participant absent if another is open.
      void enqueue(async () => {
        if (!online(socket.data.roomId).has(socket.data.participantId)) {
          await db.matchParticipant.updateMany({
            where: { roomId: socket.data.roomId, participantId: socket.data.participantId },
            data: { lastSeenAt: new Date() },
          });
        }
      }).catch(() => {});
    });
  });
  const changed = (roomId: string) => io.to(`room:${roomId}`).emit('room:changed');
  roomEvents.on('changed', changed);
  return {
    io,
    close: async () => {
      closing = true;
      clearInterval(sweep);
      roomEvents.off('changed', changed);
      await queue;
      return io.close();
    },
  };
}
