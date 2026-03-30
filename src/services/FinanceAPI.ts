import { NewsItem, Sentiment, Quote } from '../types';

const determineSentiment = (text: string): Sentiment => {
  const bullishKeywords = ['beat', 'raising', 'approval', 'partnership', 'increased', 'upgrades', 'strong', 'surge', 'jump', 'record', 'growth', 'profit', 'gain', 'positive', 'higher', 'buy', 'outperform', 'bull', 'soar', 'rally', 'breakout', 'momentum', 'dividend', 'expansion', 'acquisition', 'merger', 'optimism', 'rebound', 'recovery'];
  const bearishKeywords = ['disruptions', 'delays', 'resignation', 'headwinds', 'lawsuit', 'infringement', 'fall', 'drop', 'decline', 'loss', 'miss', 'downgrade', 'weak', 'lower', 'sell', 'underperform', 'bear', 'plunge', 'crash', 'slump', 'warning', 'bankruptcy', 'debt', 'inflation', 'recession', 'layoffs', 'probe', 'investigation', 'scandal'];
  
  const lowerText = text.toLowerCase();
  
  let bullishScore = 0;
  let bearishScore = 0;

  bullishKeywords.forEach(kw => { 
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    if (regex.test(lowerText)) bullishScore++; 
  });
  bearishKeywords.forEach(kw => { 
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    if (regex.test(lowerText)) bearishScore++; 
  });

  if (bullishScore > bearishScore) return 'Bullish';
  if (bearishScore > bullishScore) return 'Bearish';
  return 'Noise';
};

const normalizeHeadline = (headline: string): string => {
  return headline.toLowerCase().replace(/[^a-z0-9]/g, '');
};

export class FinanceAPI {
  private static newsCache = new Map<string, { data: NewsItem[], timestamp: number }>();
  private static CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  public static mapTicker(ticker: string): string {
    const upper = ticker.toUpperCase();
    const symbolMap: Record<string, string> = {
      // Crypto
      'BTC': 'BINANCE:BTCUSDT',
      'ETH': 'BINANCE:ETHUSDT',
      'SOL': 'BINANCE:SOLUSDT',
      'BNB': 'BINANCE:BNBUSDT',
      'XRP': 'BINANCE:XRPUSDT',
      'DOGE': 'BINANCE:DOGEUSDT',
      'ADA': 'BINANCE:ADAUSDT',
      // Forex
      'EUR': 'OANDA:EUR_USD',
      'GBP': 'OANDA:GBP_USD',
      'JPY': 'OANDA:USD_JPY',
    };
    return symbolMap[upper] || upper;
  }

  private static async fetchWithRetry(url: string, retries = 3, baseDelay = 1000): Promise<Response> {
    try {
      const response = await fetch(url);
      if (response.status === 429) {
        throw new Error('Rate Limit Exceeded');
      }
      return response;
    } catch (error: any) {
      if (retries > 0) {
        const jitter = 0.5 + Math.random();
        const delay = baseDelay * jitter;
        console.warn(`Finnhub API error. Retrying in ${Math.round(delay)}ms... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetchWithRetry(url, retries - 1, baseDelay * 2);
      }
      throw error;
    }
  }

  static async fetchRedditPosts(tickers: string[]): Promise<NewsItem[]> {
    if (tickers.length === 0) return [];
    try {
      // Limit to max 3 tickers to avoid overly complex queries
      const query = tickers.slice(0, 3).join(' OR ');
      const response = await fetch(`https://www.reddit.com/r/wallstreetbets/search.json?q=${encodeURIComponent(query)}&restrict_sr=on&sort=new&limit=10`);
      if (!response.ok) return [];
      const data = await response.json();
      
      return data.data.children.map((child: any) => {
        const post = child.data;
        const text = post.title + ' ' + (post.selftext || '');
        // Try to guess the ticker
        const matchedTicker = tickers.find(t => text.includes(t)) || tickers[0];
        
        return {
          id: `reddit_${post.id}`,
          ticker: matchedTicker,
          headline: post.title,
          summary: post.selftext ? post.selftext.substring(0, 200) + (post.selftext.length > 200 ? '...' : '') : '',
          sentiment: determineSentiment(text),
          timestamp: new Date(post.created_utc * 1000),
          source: `Reddit (r/${post.subreddit})`,
          url: `https://reddit.com${post.permalink}`,
          image: post.thumbnail && post.thumbnail.startsWith('http') ? post.thumbnail : ''
        };
      });
    } catch (e) {
      console.warn("Reddit fetch failed", e);
      return [];
    }
  }

  static async fetchGlobalRedditPosts(): Promise<NewsItem[]> {
    try {
      const response = await fetch(`https://www.reddit.com/r/wallstreetbets/hot.json?limit=15`);
      if (!response.ok) return [];
      const data = await response.json();
      
      return data.data.children.map((child: any) => {
        const post = child.data;
        const text = post.title + ' ' + (post.selftext || '');
        
        return {
          id: `reddit_${post.id}`,
          ticker: 'WSB',
          headline: post.title,
          summary: post.selftext ? post.selftext.substring(0, 200) + (post.selftext.length > 200 ? '...' : '') : '',
          sentiment: determineSentiment(text),
          timestamp: new Date(post.created_utc * 1000),
          source: `Reddit (r/${post.subreddit})`,
          url: `https://reddit.com${post.permalink}`,
          image: post.thumbnail && post.thumbnail.startsWith('http') ? post.thumbnail : ''
        };
      });
    } catch (e) {
      console.warn("Reddit global fetch failed", e);
      return [];
    }
  }

  /**
   * Fetches real-time news for a given list of tickers.
   * Requires VITE_FINNHUB_API_KEY.
   */
  static async fetchNews(tickers: string[]): Promise<NewsItem[]> {
    if (tickers.length === 0) return [];

    const apiKey = import.meta.env.VITE_FINNHUB_API_KEY;

    if (!apiKey) {
      throw new Error("Missing VITE_FINNHUB_API_KEY. Please add your Finnhub API key in the Settings menu to get real market data.");
    }

    const today = new Date();
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const toDate = today.toISOString().split('T')[0];
    const fromDate = lastWeek.toISOString().split('T')[0];

    const fetchPromises = tickers.map(async (originalTicker) => {
      const mappedTicker = this.mapTicker(originalTicker);
      const cached = this.newsCache.get(originalTicker);
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        return cached.data;
      }

      try {
        const response = await this.fetchWithRetry(`https://finnhub.io/api/v1/company-news?symbol=${mappedTicker}&from=${fromDate}&to=${toDate}&token=${apiKey}`);
        if (!response.ok) {
          console.error(`Failed to fetch news for ${originalTicker}: ${response.statusText}`);
          return [];
        }
        const data = await response.json();
        
        // Map Finnhub response to our NewsItem interface
        const mappedData = data
          .filter((item: any) => item.headline && item.headline.trim().length > 5)
          .map((item: any) => ({
            id: item.id.toString(),
            ticker: originalTicker,
            headline: item.headline.trim(),
            summary: item.summary ? item.summary.trim() : '',
            sentiment: determineSentiment(item.headline + ' ' + (item.summary || '')),
            timestamp: new Date(item.datetime * 1000),
            source: item.source || 'Unknown Source',
            url: item.url,
            image: item.image || ''
          }));

        // Deduplicate by normalized headline to improve collection quality
        const uniqueData: NewsItem[] = [];
        const seenHeadlines = new Set<string>();
        for (const item of mappedData) {
          const normalized = normalizeHeadline(item.headline);
          if (!seenHeadlines.has(normalized)) {
            seenHeadlines.add(normalized);
            uniqueData.push(item);
          }
        }

        this.newsCache.set(originalTicker, { data: uniqueData, timestamp: Date.now() });
        return uniqueData;
      } catch (err) {
        console.warn(`Network error fetching news for ${originalTicker}.`);
        return [];
      }
    });

    const [finnhubResults, redditResults] = await Promise.allSettled([
      Promise.all(fetchPromises),
      this.fetchRedditPosts(tickers)
    ]);

    let combinedNews: NewsItem[] = [];
    if (finnhubResults.status === 'fulfilled') {
      combinedNews = [...combinedNews, ...finnhubResults.value.flat()];
    }
    if (redditResults.status === 'fulfilled') {
      combinedNews = [...combinedNews, ...redditResults.value];
    }
    
    // Deduplicate by ID to prevent React key errors
    const uniqueNewsMap = new Map<string, NewsItem>();
    for (const item of combinedNews) {
      if (!uniqueNewsMap.has(item.id)) {
        uniqueNewsMap.set(item.id, item);
      }
    }
    const uniqueNews = Array.from(uniqueNewsMap.values());
    
    // Sort by newest first and take top 30 to avoid overwhelming the UI/AI
    return uniqueNews
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 30);
  }

  /**
   * Fetches global financial news.
   * Requires VITE_FINNHUB_API_KEY.
   */
  static async fetchGlobalNews(): Promise<NewsItem[]> {
    const apiKey = import.meta.env.VITE_FINNHUB_API_KEY;

    if (!apiKey) {
      throw new Error("Missing VITE_FINNHUB_API_KEY.");
    }

    try {
      const [finnhubResponse, redditResults] = await Promise.allSettled([
        this.fetchWithRetry(`https://finnhub.io/api/v1/news?category=general&token=${apiKey}`),
        this.fetchGlobalRedditPosts()
      ]);

      let mappedData: NewsItem[] = [];

      if (finnhubResponse.status === 'fulfilled' && finnhubResponse.value.ok) {
        const data = await finnhubResponse.value.json();
        mappedData = data
          .filter((item: any) => item.headline && item.headline.trim().length > 5)
          .map((item: any) => ({
            id: item.id.toString(),
            ticker: item.related || 'GLOBAL',
            headline: item.headline.trim(),
            summary: item.summary ? item.summary.trim() : '',
            sentiment: determineSentiment(item.headline + ' ' + (item.summary || '')),
            timestamp: new Date(item.datetime * 1000),
            source: item.source || 'Unknown Source',
            url: item.url,
            image: item.image || ''
          }));
      } else if (finnhubResponse.status === 'fulfilled' && !finnhubResponse.value.ok) {
        console.error(`Failed to fetch global news: ${finnhubResponse.value.statusText}`);
      }

      if (redditResults.status === 'fulfilled') {
        mappedData = [...mappedData, ...redditResults.value];
      }

      // Deduplicate global news
      const uniqueData: NewsItem[] = [];
      const seenHeadlines = new Set<string>();
      for (const item of mappedData) {
        const normalized = normalizeHeadline(item.headline);
        if (!seenHeadlines.has(normalized)) {
          seenHeadlines.add(normalized);
          uniqueData.push(item);
        }
      }

      return uniqueData
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 30);
    } catch (err) {
      console.warn(`Network error fetching global news.`);
      return [];
    }
  }

  /**
   * Searches for stock symbols matching the query.
   * Requires VITE_FINNHUB_API_KEY.
   */
  static async searchSymbol(query: string): Promise<{ symbol: string; description: string }[]> {
    if (!query.trim()) return [];

    const apiKey = import.meta.env.VITE_FINNHUB_API_KEY;
    if (!apiKey) return [];

    try {
      const response = await this.fetchWithRetry(`https://finnhub.io/api/v1/search?q=${query}&token=${apiKey}`);
      if (!response.ok) return [];
      
      const data = await response.json();
      
      if (data.result) {
        // Filter out non-US stocks (those with dots in the symbol) for simplicity, and limit to 5 results
        return data.result
          .filter((item: any) => !item.symbol.includes('.'))
          .slice(0, 5)
          .map((item: any) => ({
            symbol: item.symbol,
            description: item.description
          }));
      }
      return [];
    } catch (err) {
      console.warn(`Failed to search symbol: ${query}`);
      return [];
    }
  }

  /**
   * Fetches real-time quotes for a given list of tickers.
   * Requires VITE_FINNHUB_API_KEY.
   */
  static async fetchQuotes(tickers: string[]): Promise<Record<string, Quote>> {
    if (tickers.length === 0) return {};

    const apiKey = import.meta.env.VITE_FINNHUB_API_KEY;

    if (!apiKey) {
      throw new Error("Missing VITE_FINNHUB_API_KEY.");
    }

    const quotes: Record<string, Quote> = {};
    
    // Mock data for NGX tickers since Finnhub doesn't support them
    const ngxBasePrices: Record<string, number> = {
      'DANGCEM': 650.00,
      'MTNN': 240.50,
      'ZENITHBANK': 38.45,
      'GTCO': 42.10,
      'SEPLAT': 3400.00,
      'NESTLE': 900.00,
      'STANBIC': 55.00,
      'FBNH': 28.50,
      'UBA': 25.30,
      'ACCESS': 22.15,
    };

    const fetchPromises = tickers.map(async (originalTicker) => {
      // Check if it's an NGX ticker first
      if (ngxBasePrices[originalTicker]) {
        const basePrice = ngxBasePrices[originalTicker];
        // Add some random fluctuation (-2% to +2%)
        const fluctuation = basePrice * (Math.random() * 0.04 - 0.02);
        const currentPrice = basePrice + fluctuation;
        const change = fluctuation;
        const changePercent = (change / basePrice) * 100;

        quotes[originalTicker] = {
          ticker: originalTicker,
          price: currentPrice,
          change,
          changePercent,
          previousClose: basePrice,
          lastUpdated: Date.now()
        };
        return;
      }

      const mappedTicker = this.mapTicker(originalTicker);
      try {
        const response = await this.fetchWithRetry(`https://finnhub.io/api/v1/quote?symbol=${mappedTicker}&token=${apiKey}`);
        if (!response.ok) return;
        
        const data = await response.json();
        
        // Finnhub quote response: c (current price), d (change), dp (percent change), pc (previous close)
        if (data.c !== undefined && data.c !== 0) {
          quotes[originalTicker] = {
            ticker: originalTicker,
            price: data.c,
            change: data.d,
            changePercent: data.dp,
            previousClose: data.pc,
            lastUpdated: Date.now()
          };
        }
      } catch (err) {
        console.warn(`Failed to fetch quote for ${originalTicker}`);
      }
    });

    await Promise.all(fetchPromises);
    return quotes;
  }
}
