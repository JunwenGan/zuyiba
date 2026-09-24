import type { NextRequest } from 'next/server';
import { multiplayerHttp } from '@/features/multiplayer/server';

export const runtime = 'nodejs';
export async function GET(request: NextRequest, context: { params: Promise<{ roomId: string }> }) {
  return multiplayerHttp.read(request, (await context.params).roomId);
}
