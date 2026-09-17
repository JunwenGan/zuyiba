import { test, expect } from '@playwright/test';

test('one-letter search, feedback, refresh, win and restart', async ({ page }) => {
  await page.goto('/');
  await page.getByText('普通模式', { exact: true }).click();
  const search = page.getByRole('combobox');
  await search.fill('B');
  const option = page.getByRole('option', { name: /Bravo Guess 1/ });
  await expect(option).toBeVisible();
  const inputBox = await search.boundingBox();
  const listBox = await page.getByRole('listbox').boundingBox();
  expect(inputBox).not.toBeNull();
  expect(listBox).not.toBeNull();
  expect(Math.abs(listBox!.x - inputBox!.x)).toBeLessThan(2);
  expect(Math.abs(listBox!.width - inputBox!.width)).toBeLessThan(2);
  expect(listBox!.x + listBox!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await option.click();
  const row = page.getByRole('row').filter({ hasText: 'Bravo Guess 1' });
  await expect(row).toBeVisible();
  const cells = row.getByRole('cell');
  await expect(cells.nth(2).locator('div')).toHaveClass(/bg-yellow-500/);
  for (const index of [3, 4, 5, 6]) {
    await expect(cells.nth(index).locator('div')).toHaveClass(/bg-red-500/);
  }
  await expect(cells.nth(6).getByLabel('更高')).toBeVisible();
  await page.reload();
  await expect(row).toBeVisible();
  await search.fill('Bravo');
  await expect(page.getByRole('option', { name: /Bravo Guess 2/ })).toBeVisible();
  await expect(page.getByRole('option', { name: /Bravo Guess 1/ })).toHaveCount(0);
  await search.fill('A');
  await page.getByRole('option', { name: /Alpha Answer/ }).click();
  await expect(page.getByRole('dialog')).toContainText('猜对了！');
  const winningCells = page.locator('tbody tr').last().locator('td');
  for (const index of [2, 3, 4, 5, 6]) {
    await expect(winningCells.nth(index).locator('div')).toHaveClass(/bg-green-500/);
  }
  await expect(search).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('dialog')).toContainText('猜对了！');
  await page.getByRole('button', { name: '再来一局' }).click();
  await expect(page.getByRole('table')).toHaveCount(0);
  await page.getByText('普通模式', { exact: true }).click();
  await expect(search).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
  await page.getByRole('button', { name: '重新开始' }).click();
  await expect(page.getByText('选择游戏模式')).toBeVisible();
});

test('real API rejects invalid, missing, duplicate and completed guesses', async ({ request }) => {
  const created = await request.post('/api/games?mode=NORMAL');
  expect(created.status()).toBe(201);
  const { data: game } = await created.json();
  const url = `/api/games/${game.id}`;
  const initial = (await (await request.get(url)).json()).data;
  expect(initial.answer).toBeNull();
  expect(JSON.stringify(initial)).not.toContain('e2e-player-0');
  expect((await request.post(`${url}/guesses`, { data: {} })).status()).toBe(400);
  expect((await request.post(`${url}/guesses`, { data: { playerId: 'missing' } })).status()).toBe(
    404
  );
  expect((await request.get('/api/games/missing')).status()).toBe(404);
  for (let i = 1; i <= 8; i++) {
    const response = await request.post(`${url}/guesses`, {
      data: { playerId: `e2e-player-${i}` },
    });
    expect(response.status()).toBe(201);
    const { data } = await response.json();
    expect(data.game.attemptsUsed).toBe(i);
    expect(data.game.status).toBe(i === 8 ? 'LOST' : 'PLAYING');
    expect(data.guess.comparison.nationality).toBe('partial');
    expect(data.guess.comparison.age.direction).toBe('higher');
    expect(data.guess.player.age).toBe(new Date(data.game.createdAt).getUTCFullYear() - 2004);
    expect(data.guess.comparison.height).toEqual({ result: 'correct', direction: 'equal' });
    expect(data.guess.comparison.preferredFoot).toBe('correct');
    if (i === 1) {
      const duplicate = await request.post(`${url}/guesses`, {
        data: { playerId: 'e2e-player-1' },
      });
      expect(duplicate.status()).toBe(409);
      expect((await duplicate.json()).error.code).toBe('DUPLICATE_GUESS');
    }
  }
  const final = (await (await request.get(url)).json()).data;
  expect(final.guesses).toHaveLength(8);
  expect(final.answer.id).toBe('e2e-player-0');
  const completed = await request.post(`${url}/guesses`, { data: { playerId: 'e2e-player-0' } });
  expect(completed.status()).toBe(409);
  expect((await completed.json()).error.code).toBe('GAME_COMPLETED');
});
