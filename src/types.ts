export type Role = 'system' | 'user' | 'assistant';
export interface ChatMessage {
  role: Role;
  content: string;
}
