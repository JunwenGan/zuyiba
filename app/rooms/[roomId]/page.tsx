import { RoomGame } from '@/features/multiplayer/RoomGame';

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  return <RoomGame key={roomId} roomId={roomId} />;
}
