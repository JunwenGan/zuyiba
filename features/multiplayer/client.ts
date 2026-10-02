'use client';

export class RoomApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export async function roomRequest<T>(path: string, data?: unknown): Promise<T> {
  const response = await fetch(path, {
    cache: 'no-store',
    ...(data === undefined
      ? {}
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }),
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new RoomApiError(response.status, result.error?.message ?? '请求失败，请重试');
  }
  return result.data as T;
}

// Share concurrent initialization (including React Strict Mode) to avoid issuing
// two different guest cookies. Do not cache the identity after the request ends.
let pendingSession: Promise<{ participantId: string }> | undefined;
export function ensureGuestSession() {
  pendingSession ??= roomRequest<{ participantId: string }>('/api/multiplayer/session', {}).finally(
    () => {
      pendingSession = undefined;
    }
  );
  return pendingSession;
}
