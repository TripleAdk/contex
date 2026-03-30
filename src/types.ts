export type Sentiment = 'Bullish' | 'Bearish' | 'Noise';

export interface NewsItem {
  id: string;
  ticker: string;
  headline: string;
  summary: string;
  sentiment: Sentiment;
  timestamp: Date;
  source: string;
  url?: string;
  image?: string;
  likes_count?: number;
  is_liked?: boolean;
}

export interface EnrichedNewsItem extends NewsItem {
  context_summary: string;
  relevance_score: number;
}

export interface Ticker {
  symbol: string;
  name?: string;
}

export interface Post {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  author_email?: string;
  likes_count?: number;
  is_liked?: boolean;
  reactions?: {
    bullish: number;
    bearish: number;
    neutral: number;
  };
  user_reaction?: 'bullish' | 'bearish' | 'neutral' | null;
}

export interface Quote {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose?: number;
  lastUpdated?: number;
}

export interface PriceAlert {
  id: string;
  ticker: string;
  threshold: number;
  condition: 'above' | 'below';
  emailEnabled: boolean;
  isTriggered: boolean;
}
