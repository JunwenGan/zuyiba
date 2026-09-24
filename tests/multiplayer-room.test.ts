import { describe, expect, it } from 'vitest';
import { createRoom, joinRoom, setReady, startMatch } from '@/features/multiplayer/room';

function fullRoom() {
  return joinRoom(createRoom('room-1', 'host'), 'guest');
}

function readyRoom() {
  return setReady(setReady(fullRoom(), 'host', true), 'guest', true);
}

describe('friend-match lobby', () => {
  it('creates a waiting room with one unready host', () => {
    expect(createRoom('room-1', 'host')).toEqual({
      id: 'room-1',
      hostId: 'host',
      status: 'WAITING',
      participants: [{ id: 'host', isReady: false }],
    });
  });

  it.each([
    ['', 'host'],
    ['room-1', '  '],
  ])('rejects missing room/host IDs', (roomId, hostId) => {
    expect(() => createRoom(roomId, hostId)).toThrow('IDs are required');
  });

  it('adds a guest without changing the original state', () => {
    const original = createRoom('room-1', 'host');
    const joined = joinRoom(original, 'guest');
    expect(original.participants).toHaveLength(1);
    expect(joined.participants).toEqual([
      { id: 'host', isReady: false },
      { id: 'guest', isReady: false },
    ]);
  });

  it('rejects a third participant', () => {
    expect(() => joinRoom(fullRoom(), 'stranger')).toThrow('room is full');
  });

  it('rejects a blank participant ID', () => {
    expect(() => joinRoom(createRoom('room-1', 'host'), ' ')).toThrow('Participant ID is required');
  });

  it('repeated joining preserves the existing seat and readiness', () => {
    const room = readyRoom();
    expect(joinRoom(room, 'guest')).toBe(room);
  });

  it('allows an existing participant to rejoin after starting', () => {
    const room = startMatch(readyRoom(), 'host');
    expect(joinRoom(room, 'guest')).toBe(room);
    expect(() => joinRoom(room, 'stranger')).toThrow('already started');
  });

  it('changes only the requested participant readiness, without mutation', () => {
    const original = fullRoom();
    const ready = setReady(original, 'guest', true);
    expect(original.participants[1].isReady).toBe(false);
    expect(ready.participants[0].isReady).toBe(false);
    expect(ready.participants[1].isReady).toBe(true);
    expect(setReady(ready, 'guest', false).participants[1].isReady).toBe(false);
  });

  it('rejects readiness changes from outsiders', () => {
    expect(() => setReady(fullRoom(), 'stranger', true)).toThrow('not a participant');
  });

  it('does not start with only one participant, even if ready', () => {
    const room = setReady(createRoom('room-1', 'host'), 'host', true);
    expect(() => startMatch(room, 'host')).toThrow('Two ready participants');
  });

  it.each(['host', 'guest'])('does not start when only %s is ready', (id) => {
    expect(() => startMatch(setReady(fullRoom(), id, true), 'host')).toThrow(
      'Two ready participants'
    );
  });

  it.each(['guest', 'stranger'])('does not let %s start the match', (id) => {
    expect(() => startMatch(readyRoom(), id)).toThrow('Only the host');
  });

  it('lets the host start once both are ready', () => {
    const room = readyRoom();
    expect(startMatch(room, 'host').status).toBe('PLAYING');
    expect(room.status).toBe('WAITING');
  });

  it('rejects a second start and readiness changes during play', () => {
    const room = startMatch(readyRoom(), 'host');
    expect(() => startMatch(room, 'host')).toThrow('already started');
    expect(() => setReady(room, 'guest', false)).toThrow('already started');
  });
});
