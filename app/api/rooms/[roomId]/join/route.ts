import type { NextRequest } from 'next/server';
import { multiplayerHttp } from '@/features/multiplayer/server';

export const runtime = 'nodejs';
export async function POST(request: NextRequest, context: { params: Promise<{ roomId: string }> }) {
  return multiplayerHttp.join(request, (await context.params).roomId);
}
