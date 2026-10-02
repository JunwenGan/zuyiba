import 'dotenv/config';
import { createServer } from 'node:http';
import next from 'next';
import { prisma } from './lib/database/client';
import { attachRoomSockets } from './features/multiplayer/socket-server';

async function main() {
  const dev = !process.argv.includes('--production');
  const port = Number(process.env.PORT ?? 3000);
  const hostname = process.env.BIND_HOST ?? '0.0.0.0';
  const app = next({ dev, hostname, port });
  await app.prepare();
  const server = createServer(app.getRequestHandler());
  const sockets = attachRoomSockets(server, prisma, process.env.APP_ORIGIN);
  server.on('error', (error) => {
    console.error(error);
    process.exit(1);
  });
  server.listen(port, hostname, () => console.log(`Ready on http://localhost:${port}`));
  const stop = async () => {
    await sockets.close();
    server.close();
    void prisma.$disconnect().finally(() => process.exit(0));
  };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
