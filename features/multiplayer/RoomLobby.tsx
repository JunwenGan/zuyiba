'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ensureGuestSession, roomRequest } from './client';

export function RoomLobby() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState('');
  const [error, setError] = useState('');
  async function create() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await ensureGuestSession();
      const room = await roomRequest<{ id: string }>('/api/rooms', {});
      router.push(`/rooms/${room.id}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : '创建失败，请重试');
      setBusy(false);
    }
  }
  function join(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    // Accept a room ID or a copied invite URL; never navigate to an external host.
    const value = invite.trim();
    const id = value.includes('/')
      ? value.split(/[?#]/)[0].split('/').filter(Boolean).at(-1)
      : value;
    if (!id || !/^[a-f0-9-]{36}$/i.test(id)) {
      setError('请输入有效的邀请链接或房间 ID');
      return;
    }
    router.push(`/rooms/${id}`);
  }
  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-10">
      <Link className="text-sm underline" href="/">
        ← 返回单人模式
      </Link>
      <div>
        <h1 className="text-3xl font-bold">好友对战</h1>
        <p className="text-muted-foreground mt-2">同一个答案，先猜对的人获胜。</p>
      </div>
      <section className="space-y-4 rounded-xl border p-6">
        <h2 className="text-lg font-semibold">邀请朋友</h2>
        <p className="text-muted-foreground text-sm">
          创建房间后，把邀请链接发给朋友。双方准备好后，由房主开始。
        </p>
        <Button className="w-full" disabled={busy} onClick={() => void create()}>
          {busy ? '创建中…' : '创建房间'}
        </Button>
      </section>
      <form onSubmit={join} className="space-y-3 rounded-xl border p-6">
        <label htmlFor="invite" className="font-semibold">
          已有邀请？
        </label>
        <Input
          id="invite"
          value={invite}
          onChange={(event) => setInvite(event.target.value)}
          placeholder="粘贴邀请链接或房间 ID"
          required
        />
        <Button variant="outline" type="submit" className="w-full" disabled={busy}>
          打开邀请
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <p className="text-muted-foreground text-sm">
        每个房间只进行一局。测试两个玩家时，请使用不同浏览器或无痕窗口。
      </p>
    </main>
  );
}
