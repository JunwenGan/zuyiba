import { test, expect } from '@playwright/test';

test('eight guesses disable input, then both players see a persistent draw', async ({
  page,
  browser,
}) => {
  const context = await browser.newContext();
  const friend = await context.newPage();
  try {
    await page.goto('/rooms');
    await page.getByRole('button', { name: '创建房间', exact: true }).click();
    const url = await page.getByLabel('邀请链接', { exact: true }).inputValue();
    await friend.goto(url);
    await friend.getByRole('button', { name: '加入房间', exact: true }).click();
    await friend.getByRole('button', { name: '准备', exact: true }).click();
    await page.getByRole('button', { name: '准备', exact: true }).click();
    await page.getByRole('button', { name: '开始对战', exact: true }).click();
    await expect(friend.getByRole('combobox')).toBeEnabled();
    // Real API submissions keep the test quick while exercising live browser updates.
    const guess = (target: typeof page, index: number) =>
      target.evaluate(async (index) => {
        const roomId = location.pathname.split('/').pop();
        const response = await fetch(`/api/rooms/${roomId}/guesses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId: `e2e-player-${index}` }),
        });
        return response.status;
      }, index);
    for (let i = 1; i <= 8; i++) expect(await guess(page, i)).toBe(200);
    await expect(page.getByRole('combobox')).toBeDisabled();
    await expect(page.getByText('你的机会已用完，等待朋友完成猜测。')).toBeVisible();
    await expect(friend.getByRole('combobox')).toBeEnabled();
    expect(await guess(page, 0)).toBe(409);
    await page.reload();
    await expect(page.getByRole('combobox')).toBeDisabled();
    for (let i = 1; i <= 8; i++) expect(await guess(friend, i)).toBe(200);
    for (const target of [page, friend]) {
      await expect(target.getByRole('heading', { name: '平局！' })).toBeVisible();
      await expect(target.getByText('Alpha Answer', { exact: true })).toBeVisible();
      await expect(target.getByRole('combobox')).toHaveCount(0);
    }
    await friend.reload();
    await expect(friend.getByRole('heading', { name: '平局！' })).toBeVisible();
  } finally {
    await context.close();
  }
});

test('friends join, ready, play and receive the winner live', async ({
  page,
  browser,
}, testInfo) => {
  const friendContext = await browser.newContext();
  const friend = await friendContext.newPage();
  try {
    await page.goto('/');
    await page.getByRole('link', { name: '好友对战 →' }).click();
    await page.getByRole('button', { name: '创建房间', exact: true }).click();
    await expect(page.getByText('实时连接已建立', { exact: true })).toBeVisible();
    const url = await page.getByLabel('邀请链接', { exact: true }).inputValue();
    await friend.goto(url);
    await friend.getByRole('button', { name: '加入房间', exact: true }).click();
    await expect(friend.getByText('实时连接已建立', { exact: true })).toBeVisible();
    await expect(page.getByText('朋友未准备', { exact: true })).toBeVisible();
    await friend.getByRole('button', { name: '准备', exact: true }).click();
    await expect(page.getByText('朋友已准备', { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('lobby.png'), fullPage: true });
    await page.getByRole('button', { name: '准备', exact: true }).click();
    await page.getByRole('button', { name: '开始对战', exact: true }).click();
    await expect(friend.getByRole('heading', { name: '对战进行中' })).toBeVisible();
    const search = page.getByRole('combobox');
    await search.fill('B');
    await page.getByRole('option', { name: /Bravo Guess 1/ }).click();
    await expect(page.getByRole('row').filter({ hasText: 'Bravo Guess 1' })).toBeVisible();
    const opponentGrid = friend.getByRole('table', { name: '朋友的猜测颜色' });
    await expect(opponentGrid).toBeVisible();
    await expect(opponentGrid.getByLabel('国籍：相近')).toHaveClass(/bg-yellow-500/);
    await expect(opponentGrid.getByLabel('俱乐部：错误')).toHaveClass(/bg-red-500/);
    await expect(opponentGrid.getByLabel('年龄：错误')).toHaveClass(/bg-red-500/);
    await expect(friend.getByText('Bravo Guess 1', { exact: true })).toHaveCount(0);
    await expect(friend.getByText('Portugal', { exact: true })).toHaveCount(0);
    await friend.reload();
    await expect(opponentGrid.getByRole('row')).toHaveCount(2);
    await expect(friend.getByText('实时连接已建立', { exact: true })).toBeVisible();
    // Both sides see the other person's colors, live, with distinct private names.
    await friend.getByRole('combobox').fill('B');
    await friend.getByRole('option', { name: /Bravo Guess 2/ }).click();
    const hostGrid = page.getByRole('table', { name: '朋友的猜测颜色' });
    await expect(hostGrid.getByRole('row')).toHaveCount(2);
    await expect(page.getByText('Bravo Guess 2', { exact: true })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('opponent-colors.png'), fullPage: true });
    await page.reload();
    await expect(page.getByRole('row').filter({ hasText: 'Bravo Guess 1' })).toBeVisible();
    // Disconnect the losing browser while the other wins; reconnect must resync.
    await page.context().setOffline(true);
    await expect(page.getByText('连接中断，正在重连…')).toBeVisible({ timeout: 40_000 });
    await friend.getByRole('combobox').fill('A');
    await friend.getByRole('option', { name: /Alpha Answer/ }).click();
    await expect(friend.getByRole('heading', { name: '你赢了！' })).toBeVisible();
    await page.context().setOffline(false);
    await expect(page.getByRole('heading', { name: '朋友先猜中了' })).toBeVisible();
    await expect(page.getByText('Alpha Answer', { exact: true })).toBeVisible();
    await expect(page.getByRole('combobox')).toHaveCount(0);
    await expect(hostGrid.getByRole('row')).toHaveCount(3);
    await expect(hostGrid.getByRole('row').last().getByLabel('国籍：正确')).toHaveClass(
      /bg-green-500/
    );
    await page.screenshot({ path: testInfo.outputPath('result.png'), fullPage: true });
    await friend.reload();
    await expect(friend.getByRole('heading', { name: '你赢了！' })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true);
    // Replay preserves the old result and lets both players opt into one new lobby.
    const previousUrl = friend.url();
    await friend.getByRole('button', { name: '再来一局', exact: true }).click();
    await expect(friend.getByText('等待房主开始对战', { exact: true })).toBeVisible();
    expect(friend.url()).not.toBe(previousUrl);
    await page.getByRole('button', { name: '进入下一局', exact: true }).click();
    await expect(page.getByLabel('邀请链接', { exact: true })).toHaveValue(friend.url());
    await expect(page.getByRole('button', { name: '开始对战', exact: true })).toBeDisabled();
    await expect(page.getByRole('table')).toHaveCount(0);
    await friend.getByRole('button', { name: '准备', exact: true }).click();
    await page.getByRole('button', { name: '准备', exact: true }).click();
    await page.getByRole('button', { name: '开始对战', exact: true }).click();
    friend.once('dialog', (dialog) => dialog.dismiss());
    await friend.getByRole('button', { name: '退出对战', exact: true }).click();
    await expect(friend.getByRole('heading', { name: '对战进行中' })).toBeVisible();
    friend.once('dialog', (dialog) => dialog.accept());
    await friend.getByRole('button', { name: '退出对战', exact: true }).click();
    await expect(friend.getByRole('heading', { name: '你已认输' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '你赢了！' })).toBeVisible();
    await friend.reload();
    await expect(friend.getByRole('heading', { name: '你已认输' })).toBeVisible();
  } finally {
    await page.context().setOffline(false);
    await friendContext.close();
  }
});
