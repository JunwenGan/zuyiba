import { request, expect } from '@playwright/test';

// Verify real API/database readiness before browser interaction assertions.
export default async function warmup() {
  const api = await request.newContext({ baseURL: 'http://127.0.0.1:3100', timeout: 120_000 });
  try {
    const created = await api.post('/api/games?mode=NORMAL');
    expect(created.status()).toBe(201);
    const { data } = await created.json();
    expect((await api.get(`/api/games/${data.id}`)).status()).toBe(200);
    expect((await api.get('/api/players/search?q=B')).status()).toBe(200);
    const guess = await api.post(`/api/games/${data.id}/guesses`, {
      data: { playerId: 'e2e-player-1' },
    });
    expect(guess.status()).toBe(201);
  } finally {
    await api.dispose();
  }
}
