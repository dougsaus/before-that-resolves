// Shared types for Before That Resolves
// These will be expanded as we build each agent feature

export interface Card {
  id: string;
  name: string;
  mana_cost?: string;
  type_line: string;
  oracle_text?: string;
  colors?: string[];
  color_identity: string[];
  power?: string;
  toughness?: string;
  loyalty?: string;
  image_uris?: {
    normal?: string;
    large?: string;
    small?: string;
    art_crop?: string;
  };
}

export interface DeckList {
  id?: string;
  name: string;
  commander: Card;
  cards: Card[];
  created_at?: Date;
  updated_at?: Date;
}

export interface AgentQuery {
  type: 'card_search' | 'deck_validation' | 'power_assessment' | 'combo_detection';
  query: string;
  context?: unknown;
}

export interface AgentResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  timestamp: Date;
}
