export interface Profile {
  id: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
  last_seen?: string;
  online_status?: 'online' | 'offline';
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  sender?: Profile;
  effect: string;
  is_opened: boolean;
  size?: number;
}

export interface Sticker {
  id: string;
  user_id: string;
  image_url: string;
  created_at: string;
}

export interface PresenceState {
  user_id: string;
  online_at: string;
}
