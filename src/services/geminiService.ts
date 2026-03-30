import { GoogleGenAI, Type } from '@google/genai';
import { NewsItem, EnrichedNewsItem } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Simple in-memory cache
const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes (increased to save quota)
const DASHBOARD_CACHE_TTL = 30 * 60 * 1000; // 30 minutes for dashboard

async function withRetry<T>(fn: () => Promise<T>, retries = 3, baseDelay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const errorStr = error?.message || (typeof error === 'object' ? JSON.stringify(error, Object.getOwnPropertyNames(error)) : String(error));
    const isTransient = errorStr.includes('500') || errorStr.includes('UNKNOWN') || errorStr.includes('xhr error');
    const isRateLimit = errorStr.includes('429') || errorStr.includes('quota') || errorStr.includes('RESOURCE_EXHAUSTED');
    
    if ((isTransient || isRateLimit) && retries > 0) {
      // Exponential backoff with jitter
      const jitter = 0.5 + Math.random(); // Random factor between 0.5 and 1.5
      const delay = (isRateLimit ? baseDelay * 2 : baseDelay) * jitter;
      
      console.warn(`Gemini API error (${isRateLimit ? 'Rate Limit' : 'Transient'}). Retrying in ${Math.round(delay)}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, baseDelay * 1.5);
    }
    throw error;
  }
}

function getCacheKey(fnName: string, args: any): string {
  return `${fnName}:${JSON.stringify(args)}`;
}

function getCachedData<T>(key: string, ttl = CACHE_TTL, ignoreTtl = false): T | null {
  // Check memory cache first
  const cached = cache.get(key);
  if (cached && (ignoreTtl || Date.now() - cached.timestamp < ttl)) {
    return cached.data as T;
  }

  // Check localStorage for persistent cache
  try {
    const localCached = localStorage.getItem(`gemini_cache_${key}`);
    if (localCached) {
      const { data, timestamp } = JSON.parse(localCached);
      if (ignoreTtl || Date.now() - timestamp < ttl) {
        // Hydrate memory cache
        cache.set(key, { data, timestamp });
        return data as T;
      }
    }
  } catch (e) {
    console.warn("Failed to read from localStorage cache", e);
  }

  return null;
}

function setCachedData(key: string, data: any): void {
  const timestamp = Date.now();
  cache.set(key, { data, timestamp });
  
  try {
    localStorage.setItem(`gemini_cache_${key}`, JSON.stringify({ data, timestamp }));
  } catch (e) {
    console.warn("Failed to write to localStorage cache", e);
  }
}

export interface UserProfile {
  riskTolerance: string;
  preferredSectors: string[];
}

export interface MarketInsights {
  mood: string;
  topMovers: string[];
  sectorsInFocus: string[];
}

export async function generateMarketMood(newsItems: NewsItem[], profile?: UserProfile | null, forceRefresh: boolean = false): Promise<MarketInsights> {
  const defaultInsights: MarketInsights = {
    mood: "Not enough data to determine market mood. Add tickers to your portfolio.",
    topMovers: [],
    sectorsInFocus: []
  };

  if (newsItems.length === 0) {
    return defaultInsights;
  }

  const newsContext = newsItems.slice(0, 15).map(item => 
    `[${item.ticker}] (${item.sentiment}): ${item.headline}`
  ).join('\n');

  let systemInstruction = "You are an expert financial advisor providing a brief market mood summary based on recent news. Output strictly a JSON object with 'mood' (string, 1 paragraph), 'topMovers' (array of 3 ticker strings), and 'sectorsInFocus' (array of 2 sector strings).";
  let promptPrefix = "Analyze the following recent financial news headlines and provide a concise, professional, 1-paragraph summary of the overall \"Market Mood\". Focus on the aggregate sentiment and key drivers. Keep it under 100 words. Also identify the top 3 movers and 2 sectors in focus based on the news.";

  if (profile) {
    systemInstruction = `You are an elite AI financial advisor. Your client has a ${profile.riskTolerance} risk tolerance and prefers the following sectors: ${profile.preferredSectors.length > 0 ? profile.preferredSectors.join(', ') : 'None specified'}. Output strictly a JSON object with 'mood' (string, 1 paragraph), 'topMovers' (array of 3 ticker strings), and 'sectorsInFocus' (array of 2 sector strings).`;
    promptPrefix = `Analyze the following recent financial news headlines for the client's watchlist. Provide a highly personalized, 1-paragraph "Daily AI Briefing" explaining exactly how today's news impacts their specific portfolio strategy, keeping their ${profile.riskTolerance} risk tolerance and sector preferences in mind. Keep it under 100 words. Also identify the top 3 movers and 2 sectors in focus based on the news.`;
  }

  const cacheKey = getCacheKey('generateMarketMood', { newsItems: newsItems.map(n => n.id), profile });

  try {
    if (!forceRefresh) {
      const cached = getCachedData<MarketInsights>(cacheKey);
      if (cached) return cached;
    }

    const response = await withRetry(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `${promptPrefix}\n\nNews:\n${newsContext}`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            mood: { type: Type.STRING },
            topMovers: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            sectorsInFocus: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["mood", "topMovers", "sectorsInFocus"]
        }
      }
    }));

    const jsonStr = response.text?.trim() || "{}";
    const parsed = JSON.parse(jsonStr);
    
    const result = {
      mood: parsed.mood || "Unable to generate market mood at this time.",
      topMovers: Array.isArray(parsed.topMovers) ? parsed.topMovers : [],
      sectorsInFocus: Array.isArray(parsed.sectorsInFocus) ? parsed.sectorsInFocus : []
    };

    setCachedData(cacheKey, result);
    return result;
  } catch (error: any) {
    const errorStr = error?.message || (typeof error === 'object' ? JSON.stringify(error, Object.getOwnPropertyNames(error)) : String(error));
    const isRateLimit = errorStr.includes('429') || errorStr.includes('quota') || errorStr.includes('RESOURCE_EXHAUSTED');
    
    if (isRateLimit) {
      console.warn("Gemini API rate limit exceeded. Using fallback mode.");
      const staleData = getCachedData<MarketInsights>(cacheKey, CACHE_TTL, true);
      if (staleData) return staleData;
      return {
        mood: "Market mood is currently unavailable due to API rate limits. Please try again later.",
        topMovers: ["N/A"],
        sectorsInFocus: ["N/A"]
      };
    }
    
    console.error("Error generating market mood:", error);
    return {
      mood: "Error connecting to AI Insights engine.",
      topMovers: [],
      sectorsInFocus: []
    };
  }
}

export async function summarizeNewsItem(newsItem: NewsItem): Promise<string> {
  const cacheKey = getCacheKey('summarizeNewsItem', { id: newsItem.id });
  try {
    const cached = getCachedData<string>(cacheKey);
    if (cached) return cached;

    const contents = `Please provide a concise, 2-3 sentence summary of the following financial news article. Focus on the key takeaways and market impact.\n\nHeadline: ${newsItem.headline}\nSummary: ${newsItem.summary || "No summary provided."}`;
    
    const config: any = {
      systemInstruction: "You are a concise financial analyst. Provide a brief, objective summary of the news.",
    };

    const response = await withRetry(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents,
      config
    }));

    const result = response.text?.trim() || "Could not generate summary.";
    setCachedData(cacheKey, result);
    return result;
  } catch (error: any) {
    const errorStr = error?.message || (typeof error === 'object' ? JSON.stringify(error, Object.getOwnPropertyNames(error)) : String(error));
    const isRateLimit = errorStr.includes('429') || errorStr.includes('quota') || errorStr.includes('RESOURCE_EXHAUSTED');
    
    if (isRateLimit) {
      console.warn("Gemini API rate limit exceeded. Using stale summary if available.");
      const staleData = getCachedData<string>(cacheKey, CACHE_TTL, true);
      if (staleData) return staleData;
      return "Summary generation is currently unavailable due to API rate limits. Please try again later.";
    }
    
    console.error("Error generating summary:", error);
    return "Summary generation failed due to an error. Please try again later.";
  }
}

export async function fetchArticleContent(url: string): Promise<string> {
  const cacheKey = getCacheKey('fetchArticleContent', { url });
  try {
    const cached = getCachedData<string>(cacheKey);
    if (cached) return cached;

    const response = await withRetry(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are an expert web scraper and financial journalist. Extract the main article content from this URL: ${url}. 
      
Rules:
1. Start with a brief 2-3 sentence TL;DR summary in bold.
2. Then provide the main article content.
3. Format beautifully in Markdown with appropriate headings (##), paragraphs, and bullet points.
4. Strictly exclude navigation, ads, footer content, author bios, and unrelated sidebar links.
5. If the article is behind a hard paywall and you can only see a snippet, extract whatever is available and add a note: "*Note: Full article may be behind a paywall.*"`,
      config: {
        tools: [{ urlContext: {} }],
        temperature: 0.2,
      }
    }));

    const result = response.text?.trim() || "Could not extract article content.";
    setCachedData(cacheKey, result);
    return result;
  } catch (error: any) {
    const errorStr = error?.message || (typeof error === 'object' ? JSON.stringify(error, Object.getOwnPropertyNames(error)) : String(error));
    const isRateLimit = errorStr.includes('429') || errorStr.includes('quota') || errorStr.includes('RESOURCE_EXHAUSTED');
    
    if (isRateLimit) {
      console.warn("Gemini API rate limit exceeded. Using stale article content if available.");
      const staleData = getCachedData<string>(cacheKey, CACHE_TTL, true);
      if (staleData) return staleData;
      return "Article content is currently unavailable due to API rate limits. Please try again later.";
    }

    console.error("Error fetching article content:", error);
    return "Failed to load article content. The publisher might restrict access.";
  }
}

export async function generateTrendingTopics(newsItems: NewsItem[]): Promise<string[]> {
  if (newsItems.length === 0) {
    return ["#Markets", "#Investing", "#Stocks"];
  }

  const newsContext = newsItems.slice(0, 15).map(item => item.headline).join('\n');
  const cacheKey = getCacheKey('generateTrendingTopics', { ids: newsItems.map(n => n.id) });

  try {
    const cached = getCachedData<string[]>(cacheKey);
    if (cached) return cached;

    const response = await withRetry(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Based on the following recent financial news headlines, generate exactly 5 trending keywords or topics (like $AAPL, #InterestRates, AI Boom) that a user might want to post about. Return ONLY a JSON array of strings.\n\nHeadlines:\n${newsContext}`,
      config: {
        systemInstruction: "You are a financial trend analyzer. Output strictly a JSON array of 5 strings.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING
          }
        }
      }
    }));

    const jsonStr = response.text?.trim() || "[]";
    const parsed = JSON.parse(jsonStr);
    const result = Array.isArray(parsed) && parsed.length > 0 ? parsed : ["#Markets", "#Investing", "#Stocks"];
    setCachedData(cacheKey, result);
    return result;
  } catch (error: any) {
    const errorStr = error?.message || (typeof error === 'object' ? JSON.stringify(error, Object.getOwnPropertyNames(error)) : String(error));
    const isRateLimit = errorStr.includes('429') || errorStr.includes('quota') || errorStr.includes('RESOURCE_EXHAUSTED');
    
    if (isRateLimit) {
      console.warn("Gemini API rate limit exceeded. Using default trending topics.");
      const staleData = getCachedData<string[]>(cacheKey, CACHE_TTL, true);
      if (staleData) return staleData;
    } else {
      console.error("Error generating trending topics:", error);
    }
    return ["#Markets", "#Investing", "#Stocks"];
  }
}

export interface MarketDashboardData {
  crypto: {
    name: string;
    symbol: string;
    price: number;
    change24h: number;
  }[];
  fiat: {
    name: string;
    symbol: string;
    rate: number;
    change24h: number;
    currencySymbol: string;
  }[];
}

export async function fetchMarketDashboardData(): Promise<MarketDashboardData> {
  const cacheKey = 'marketDashboardData';
  const cached = getCachedData<MarketDashboardData>(cacheKey, DASHBOARD_CACHE_TTL);
  if (cached) return cached;

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Fetch the current real-time prices and 24h changes for:
1. Crypto: BTC, ETH, SOL, BNB, XRP (Top 5 by market cap).
2. Fiat: EUR, GBP, JPY, CAD, CNY, NGN (Relative to 1 US Dollar).

Return ONLY a JSON object with 'crypto' and 'fiat' arrays.
Each crypto item: { name, symbol, price, change24h }
Each fiat item: { name, symbol, rate, change24h, currencySymbol }`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            crypto: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  symbol: { type: Type.STRING },
                  price: { type: Type.NUMBER },
                  change24h: { type: Type.NUMBER }
                },
                required: ["name", "symbol", "price", "change24h"]
              }
            },
            fiat: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  symbol: { type: Type.STRING },
                  rate: { type: Type.NUMBER },
                  change24h: { type: Type.NUMBER },
                  currencySymbol: { type: Type.STRING }
                },
                required: ["name", "symbol", "rate", "change24h", "currencySymbol"]
              }
            }
          },
          required: ["crypto", "fiat"]
        }
      }
    }));

    const jsonStr = response.text?.trim() || "{}";
    const parsed = JSON.parse(jsonStr);
    
    setCachedData(cacheKey, parsed);
    return parsed;
  } catch (error: any) {
    const errorStr = error?.message || (typeof error === 'object' ? JSON.stringify(error, Object.getOwnPropertyNames(error)) : String(error));
    const isRateLimit = errorStr.includes('429') || errorStr.includes('quota') || errorStr.includes('RESOURCE_EXHAUSTED');
    
    if (isRateLimit) {
      console.warn("Gemini API rate limit exceeded. Using stale dashboard data if available.");
    } else {
      console.error("Error fetching market dashboard data:", error);
    }

    // Try to get stale data
    const staleData = getCachedData<MarketDashboardData>(cacheKey, DASHBOARD_CACHE_TTL, true);
    if (staleData) {
      return staleData;
    }

    // Return fallback data if API fails and no stale data
    return {
      crypto: [
        { name: "Bitcoin", symbol: "BTC", price: 0, change24h: 0 },
        { name: "Ethereum", symbol: "ETH", price: 0, change24h: 0 },
        { name: "Solana", symbol: "SOL", price: 0, change24h: 0 },
        { name: "BNB", symbol: "BNB", price: 0, change24h: 0 },
        { name: "XRP", symbol: "XRP", price: 0, change24h: 0 },
      ],
      fiat: [
        { name: "Euro", symbol: "EUR", rate: 0, change24h: 0, currencySymbol: "€" },
        { name: "British Pound", symbol: "GBP", rate: 0, change24h: 0, currencySymbol: "£" },
        { name: "Japanese Yen", symbol: "JPY", rate: 0, change24h: 0, currencySymbol: "¥" },
        { name: "Canadian Dollar", symbol: "CAD", rate: 0, change24h: 0, currencySymbol: "$" },
        { name: "Chinese Yuan", symbol: "CNY", rate: 0, change24h: 0, currencySymbol: "¥" },
        { name: "Nigerian Naira", symbol: "NGN", rate: 0, change24h: 0, currencySymbol: "₦" },
      ]
    };
  }
}

export async function contextualizeFeed(portfolio: string[], newsItems: NewsItem[], isGlobalFeed: boolean = false, profile?: UserProfile | null): Promise<EnrichedNewsItem[]> {
  if (newsItems.length === 0) return [];
  if (!isGlobalFeed && portfolio.length === 0) return [];

  // Send a simplified version of the top 15 news items to save tokens and quota
  const rawFeed = newsItems.slice(0, 15).map(item => ({
    id: item.id,
    ticker: item.ticker,
    headline: item.headline,
    summary: item.summary
  }));

  let prompt = isGlobalFeed 
    ? `1. Global News Feed: ${JSON.stringify(rawFeed)}`
    : `1. User Portfolio: ${JSON.stringify(portfolio)}\n2. Raw News Feed: ${JSON.stringify(rawFeed)}`;

  if (profile) {
    prompt += `\n3. User Profile: Risk Tolerance: ${profile.riskTolerance}, Preferred Sectors: ${profile.preferredSectors.join(', ')}`;
  }

  const systemInstruction = isGlobalFeed
    ? `You are the Context-Aware Engine for a Financial Microblogging Platform.

Your Rules:
Analyze: Assign a sentiment_score (-1 to 1) and a priority (High/Medium/Low) for each news item.
Contextualize: Explain why it matters to the global market in 10 words or less.
${profile ? 'Personalize: Tailor the context to the user\'s risk tolerance and preferred sectors if applicable.' : ''}

Output Format: Strictly JSON.`
    : `You are the Context-Aware Engine for a Financial Microblogging Platform.

Your Rules:
Filter: If a post is not related to the User Portfolio, mark it irrelevant.
Analyze: For relevant posts, assign a sentiment_score (-1 to 1) and a priority (High/Medium/Low).
Contextualize: Explain why it matters to the user in 10 words or less (e.g., 'Affects supply chain for [Ticker]').
${profile ? 'Personalize: Tailor the context to the user\'s risk tolerance and preferred sectors if applicable.' : ''}

Output Format: Strictly JSON.`;

  const cacheKey = getCacheKey('contextualizeFeed', { portfolio, newsIds: newsItems.map(n => n.id), isGlobalFeed, profile });

  try {
    const cached = getCachedData<EnrichedNewsItem[]>(cacheKey);
    if (cached) return cached;

    const response = await withRetry(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            filtered_feed: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  headline: { type: Type.STRING },
                  sentiment: { type: Type.STRING },
                  context_summary: { type: Type.STRING },
                  relevance_score: { type: Type.NUMBER }
                },
                required: ["id", "headline", "sentiment", "context_summary", "relevance_score"]
              }
            }
          },
          required: ["filtered_feed"]
        }
      }
    }));

    const jsonStr = response.text?.trim() || "{}";
    const parsed = JSON.parse(jsonStr);
    const filteredFeed = parsed.filtered_feed || [];

    // Merge AI insights with original news items
    const enrichedNews: EnrichedNewsItem[] = [];
    for (const aiItem of filteredFeed) {
      const originalItem = newsItems.find(n => n.id === aiItem.id);
      if (originalItem) {
        enrichedNews.push({
          ...originalItem,
          sentiment: aiItem.sentiment as any,
          context_summary: aiItem.context_summary,
          relevance_score: aiItem.relevance_score
        });
      }
    }

    // Sort by relevance score descending
    const result = enrichedNews.sort((a, b) => b.relevance_score - a.relevance_score);
    setCachedData(cacheKey, result);
    return result;
  } catch (error: any) {
    const errorStr = error?.message || (typeof error === 'object' ? JSON.stringify(error, Object.getOwnPropertyNames(error)) : String(error));
    const isRateLimit = errorStr.includes('429') || errorStr.includes('quota') || errorStr.includes('RESOURCE_EXHAUSTED');
    
    if (isRateLimit) {
      console.warn("Gemini API rate limit exceeded. Using fallback mode for news feed.");
      const staleData = getCachedData<EnrichedNewsItem[]>(cacheKey, CACHE_TTL, true);
      if (staleData) return staleData;
    } else {
      console.error("Error contextualizing feed:", error);
    }
    
    // Fallback: return original items casted to EnrichedNewsItem with default values
    return newsItems.map(item => ({
      ...item,
      context_summary: isRateLimit ? "AI Rate Limit Exceeded (Quota)" : "AI Context Unavailable",
      relevance_score: 0
    }));
  }
}
