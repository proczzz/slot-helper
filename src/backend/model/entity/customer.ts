export interface Customer {
  id: string;
  channel: string;
  name: string | null;
  displayName: string | null;
  pictureUrl: string | null;
  lastMessage: string | null;
  lastMessageAt: number | null;
  aiPausedUntil: number | null;
}
