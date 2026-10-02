'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { io, type Socket } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlayerSearch } from '@/features/game/components/PlayerSearch';
import { GuessTable } from '@/features/game/components/GuessTable';
import type { MatchState } from './match-repository';
import { ensureGuestSession, roomRequest, RoomApiError } from './client';
import { OpponentGuessTable } from './OpponentGuessTable';
import { MAX_ATTEMPTS } from '@/types/database';

export function RoomGame({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [identity, setIdentity] = useState('');
  const [room, setRoom] = useState<MatchState | null>(null);
  const [phase, setPhase] = useState<'loading' | 'invite' | 'active' | 'error'>('loading');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [onlineIds, setOnlineIds] = useState<string[] | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const generation = useRef(0);
  const actionPending = useRef(false);
  const mounted = useRef(false);
  const path = `/api/rooms/${encodeURIComponent(roomId)}`;

  const refresh = useCallback(async () => {
    const ticket = ++generation.current;
    try {
      const next = await roomRequest<MatchState>(path);
      if (!mounted.current || ticket !== generation.current) return;
      setRoom(next);
      setPhase('active');
    } catch (error) {
      if (!mounted.current || ticket !== generation.current) return;
      if (error instanceof RoomApiError && error.status === 404) setPhase('invite');
      else {
        setError(error instanceof Error ? error.message : '无法读取房间');
        setPhase((current) => (current === 'loading' ? 'error' : current));
        if (error instanceof RoomApiError && error.status === 401) {
          setPhase('error');
          socketRef.current?.disconnect();
        }
      }
    }
  }, [path]);

  useEffect(() => {
    mounted.current = true;
    const invalidateReads = () => {
      generation.current++;
    };
    let cancelled = false;
    void ensureGuestSession()
      .then(async (session) => {
        if (cancelled) return;
        setIdentity(session.participantId);
        setInviteUrl(window.location.href);
        await refresh();
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setError(error instanceof Error ? error.message : '无法创建访客身份');
          setPhase('error');
        }
      });
    return () => {
      cancelled = true;
      mounted.current = false;
      invalidateReads();
    };
  }, [refresh]);

  useEffect(() => {
    if (phase !== 'active' || !identity) return;
    const socket = io({ transports: ['websocket'], auth: { roomId } });
    socketRef.current = socket;
    socket.on('connect', () => {
      setConnected(true);
      void refresh();
    });
    socket.on('room:changed', () => {
      void refresh();
    });
    socket.on('room:presence', (ids: string[]) => setOnlineIds(ids));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [phase, identity, roomId, refresh]);

  async function act(action: string, data: unknown = {}) {
    if (actionPending.current) return;
    actionPending.current = true;
    generation.current++;
    setBusy(true);
    setError('');
    try {
      const result = await roomRequest<{ roomId?: string }>(`${path}/${action}`, data);
      if (action === 'restart' && result.roomId) router.push(`/rooms/${result.roomId}`);
    } catch (error) {
      if (mounted.current) setError(error instanceof Error ? error.message : '操作失败，请重试');
    } finally {
      await refresh();
      actionPending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
    } catch {
      setError('无法自动复制，请手动选择下方链接复制。');
    }
  }
  const me = room?.participants.find((p) => p.id === identity);
  const opponent = room?.participants.find((p) => p.id !== identity);
  const host = room?.hostId === identity;
  const readyToStart = room?.participants.length === 2 && room.participants.every((p) => p.isReady);

  return (
    <main className="mx-auto flex w-full max-w-4xl min-w-0 flex-col gap-6 px-4 py-8">
      <nav className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/rooms" className="text-sm underline">
          ← 好友对战
        </Link>
        {phase === 'active' && (
          <span role="status" className="text-muted-foreground text-sm">
            {connected ? '实时连接已建立' : '连接中断，正在重连…'}
          </span>
        )}
      </nav>
      <header>
        <h1 className="text-3xl font-bold">好友对战</h1>
        <p className="text-muted-foreground mt-2">
          先猜对获胜 · 每人 {MAX_ATTEMPTS} 次机会 · 双方用完未猜中则平局
        </p>
      </header>
      {error && (
        <p role="alert" className="text-destructive rounded-lg border p-3 text-sm">
          {error}
        </p>
      )}
      {phase === 'loading' && <p role="status">正在加载房间…</p>}
      {phase === 'error' && (
        <p>
          无法进入房间。
          <button className="underline" onClick={() => window.location.reload()}>
            重新加载
          </button>
        </p>
      )}
      {phase === 'invite' && (
        <section className="space-y-4 rounded-xl border p-6">
          <h2 className="text-xl font-semibold">加入朋友的房间</h2>
          <p className="text-muted-foreground text-sm">
            点击加入后占用一个席位。房间最多两人；如果已满、已开始或不存在，将无法加入。
          </p>
          <Button disabled={busy} onClick={() => void act('join')}>
            {busy ? '加入中…' : '加入房间'}
          </Button>
        </section>
      )}
      {phase === 'active' && room && (
        <>
          {room.status === 'WAITING' && (
            <section className="space-y-4 rounded-xl border p-5">
              <label htmlFor="room-link" className="font-semibold">
                邀请链接
              </label>
              <div className="flex flex-wrap gap-2">
                <Input
                  id="room-link"
                  className="min-w-0 flex-1"
                  value={inviteUrl}
                  readOnly
                  onFocus={(event) => event.target.select()}
                />
                <Button variant="outline" onClick={() => void copy()}>
                  {copied ? '已复制' : '复制链接'}
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="bg-muted rounded-lg p-4">
                  <p className="font-medium">你{host ? '（房主）' : ''}</p>
                  <p>{me?.isReady ? '已准备' : '未准备'}</p>
                </div>
                <div className="bg-muted rounded-lg p-4">
                  <p className="font-medium">
                    朋友{opponent?.id === room.hostId ? '（房主）' : ''}
                  </p>
                  <p>
                    {!opponent ? '等待朋友加入' : opponent.isReady ? '朋友已准备' : '朋友未准备'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={busy || !connected}
                  variant="outline"
                  onClick={() => void act('ready', { isReady: !me?.isReady })}
                >
                  {me?.isReady ? '取消准备' : '准备'}
                </Button>
                {host ? (
                  <Button
                    disabled={busy || !connected || !readyToStart}
                    onClick={() => void act('start')}
                  >
                    开始对战
                  </Button>
                ) : (
                  <p className="text-muted-foreground self-center text-sm">等待房主开始对战</p>
                )}
              </div>
            </section>
          )}
          {room.status === 'PLAYING' && (
            <section className="space-y-4">
              <h2 className="text-xl font-semibold">对战进行中</h2>
              <p className="text-muted-foreground text-sm">
                断线后有 60 秒重连机会；主动退出视为认输。
              </p>
              {connected && onlineIds && opponent && !onlineIds.includes(opponent.id) && (
                <p role="status">朋友已断线，等待重连。超过 60 秒未返回将判负。</p>
              )}
              <PlayerSearch
                disabled={busy || !connected || room.guesses.length >= MAX_ATTEMPTS}
                guessedPlayerIds={new Set(room.guesses.map((g) => g.player.id))}
                onSelect={(player) => void act('guesses', { playerId: player.id })}
              />
              <p className="text-muted-foreground text-sm">
                剩余 {Math.max(0, MAX_ATTEMPTS - room.guesses.length)}{' '}
                次机会。胜负由服务器接受正确猜测的顺序决定。
              </p>
              {room.guesses.length >= MAX_ATTEMPTS && (
                <p role="status">你的机会已用完，等待朋友完成猜测。</p>
              )}
              <Button
                variant="outline"
                disabled={busy || !connected}
                onClick={() => {
                  if (window.confirm('退出将视为认输，确定退出对战吗？')) void act('leave');
                }}
              >
                退出对战
              </Button>
            </section>
          )}
          {room.status === 'FINISHED' && (
            <section role="status" className="bg-muted space-y-2 rounded-xl border p-6">
              <h2 className="text-2xl font-bold">
                {room.finishReason === 'ABANDONED'
                  ? '对战已结束（双方离线）'
                  : room.winnerId === null
                    ? '平局！'
                    : room.winnerId === identity
                      ? '你赢了！'
                      : room.finishReason === 'FORFEIT' || room.finishReason === 'DISCONNECT'
                        ? '你已认输'
                        : '朋友先猜中了'}
              </h2>
              {room.finishReason === 'FORFEIT' && <p>一方主动退出，对战结束。</p>}
              {room.finishReason === 'DISCONNECT' && <p>一方超过 60 秒未重连，对战结束。</p>}
              <p>
                答案：<strong>{room.answer?.name}</strong>
              </p>
              <Link className="inline-block pt-2 underline" href="/rooms">
                创建新的对战
              </Link>
              <div>
                <Button disabled={busy} onClick={() => void act('restart')}>
                  {room.rematchRoomId ? '进入下一局' : '再来一局'}
                </Button>
                <p className="text-muted-foreground mt-2 text-sm">
                  保留本局记录；下一局双方重新准备后开始。
                </p>
              </div>
            </section>
          )}
          {room.guesses.length > 0 && (
            <section className="min-w-0 space-y-3">
              <h2 className="font-semibold">你的猜测</h2>
              <GuessTable guesses={room.guesses} />
            </section>
          )}
          {room.status !== 'WAITING' && <OpponentGuessTable guesses={room.opponentGuesses} />}
          <Button
            variant="ghost"
            className="self-start"
            disabled={busy}
            onClick={() => {
              socketRef.current?.connect();
              void refresh();
            }}
          >
            刷新状态
          </Button>
        </>
      )}
    </main>
  );
}
