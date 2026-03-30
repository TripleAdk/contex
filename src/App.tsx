/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { PortfolioSidebar } from "./components/PortfolioSidebar";
import { SentimentCard } from "./components/SentimentCard";
import { CreatePost } from "./components/CreatePost";
import { PostCard } from "./components/PostCard";
import { AIInsights } from "./components/AIInsights";
import { Auth } from "./components/Auth";
import { ProfileSettings } from "./components/ProfileSettings";
import { ArticleModal } from "./components/ArticleModal";
import { OnboardingTutorial } from "./components/OnboardingTutorial";
import { AlertsManager } from "./components/AlertsManager";
import { MarketDashboard } from "./components/MarketDashboard";
import { ToastContainer, ToastMessage } from "./components/ToastContainer";
import { FinanceAPI } from "./services/FinanceAPI";
import {
  generateMarketMood,
  contextualizeFeed,
  UserProfile,
  MarketInsights,
} from "./services/geminiService";
import { supabase } from "./lib/supabase";
import { useAuth } from "./contexts/AuthContext";
import { EnrichedNewsItem, Quote, Post, PriceAlert } from "./types";
import {
  Terminal,
  Radio,
  AlertTriangle,
  Database,
  LogOut,
  User as UserIcon,
  MessageSquare,
  HelpCircle,
  Bell,
  Sun,
  Moon,
  Contrast,
} from "lucide-react";
import { useRealtimeQuotes } from "./hooks/useRealtimeQuotes";

export default function App() {
  const { user, signOut, isLoading: isAuthLoading } = useAuth();
  const [tickers, setTickers] = useState<string[]>([
    "AAPL",
    "MSFT",
    "NVDA",
    "TSLA",
    "AMZN",
    "META",
    "GOOGL",
    "NFLX",
  ]);
  const [news, setNews] = useState<EnrichedNewsItem[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [followingUsers, setFollowingUsers] = useState<string[]>([]);
  const followingUsersSet = useMemo(() => new Set(followingUsers), [followingUsers]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [isLoadingNews, setIsLoadingNews] = useState(false);
  const [marketInsights, setMarketInsights] = useState<MarketInsights | null>(null);
  const [isLoadingMood, setIsLoadingMood] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [sortBy, setSortBy] = useState<'timestamp' | 'relevance'>('timestamp');
  const [filterSentiment, setFilterSentiment] = useState<'All' | 'Bullish' | 'Bearish' | 'Noise'>('All');
  const [feedType, setFeedType] = useState<'global' | 'portfolio' | 'following'>('global');
  const [selectedArticleUrl, setSelectedArticleUrl] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light' | 'high-contrast'>('dark');
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchRef = useRef<Record<string, number>>({});
  const globalNewsCacheRef = useRef<{ news: EnrichedNewsItem[], insights: MarketInsights | null } | null>(null);
  const portfolioNewsCacheRef = useRef<{ news: EnrichedNewsItem[], insights: MarketInsights | null, tickers: string[] } | null>(null);
  const MIN_FETCH_INTERVAL = 60000; // 1 minute

  useRealtimeQuotes(tickers, setQuotes);

  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem('hasSeenTutorial');
    if (!hasSeenTutorial) {
      setShowTutorial(true);
    }

    // Initialize theme
    const savedTheme = localStorage.getItem('app-theme') as 'dark' | 'light' | 'high-contrast';
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  }, []);

  const toggleTheme = () => {
    const themes: ('dark' | 'light' | 'high-contrast')[] = ['dark', 'light', 'high-contrast'];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    const nextTheme = themes[nextIndex];
    
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('app-theme', nextTheme);
  };

  const addToast = useCallback((title: string, message: string, type: 'alert' | 'email') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  const handleLikeUpdate = useCallback((postId: string, isLiked: boolean, likesCount: number) => {
    setPosts(prev => prev.map(p => 
      p.id === postId ? { ...p, is_liked: isLiked, likes_count: likesCount } : p
    ));
  }, []);

  const handleFollowUpdate = useCallback((userId: string, isFollowing: boolean) => {
    if (isFollowing) {
      setFollowingUsers(prev => [...prev, userId]);
    } else {
      setFollowingUsers(prev => prev.filter(id => id !== userId));
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Check alerts whenever quotes update
  useEffect(() => {
    if (Object.keys(quotes).length === 0 || alerts.length === 0) return;

    let alertsUpdated = false;
    const newAlerts = alerts.map(alert => {
      if (alert.isTriggered) return alert;

      const quote = quotes[alert.ticker];
      if (!quote) return alert;

      let triggered = false;
      if (alert.condition === 'above' && quote.price >= alert.threshold) triggered = true;
      if (alert.condition === 'below' && quote.price <= alert.threshold) triggered = true;

      if (triggered) {
        alertsUpdated = true;
        addToast(
          `Price Alert: ${alert.ticker}`,
          `${alert.ticker} has crossed ${alert.condition} $${alert.threshold.toFixed(2)}. Current price: $${quote.price.toFixed(2)}`,
          'alert'
        );
        
        if (alert.emailEnabled) {
          setTimeout(() => {
            addToast(
              `Email Sent`,
              `Notification sent to your registered email for ${alert.ticker}.`,
              'email'
            );
          }, 1000);
        }
        
        return { ...alert, isTriggered: true };
      }
      return alert;
    });

    if (alertsUpdated) {
      setAlerts(newAlerts);
    }
  }, [quotes, alerts, addToast]);

  const handleAddAlert = useCallback((alertData: Omit<PriceAlert, 'id' | 'isTriggered'>) => {
    const newAlert: PriceAlert = {
      ...alertData,
      id: Math.random().toString(36).substring(2, 9),
      isTriggered: false,
    };
    setAlerts(prev => [...prev, newAlert]);
  }, []);

  const handleRemoveAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  const fetchNewsAndMood = useCallback(async (force = false) => {
    const now = Date.now();
    const lastFetch = lastFetchRef.current[feedType] || 0;
    
    if (!force && (now - lastFetch < MIN_FETCH_INTERVAL)) {
      console.log(`Skipping fetch for ${feedType} - data is still fresh.`);
      return;
    }

    if (tickers.length === 0 && feedType === 'portfolio') {
      setNews([]);
      setQuotes({});
      setMarketInsights({ mood: "Add tickers to your watchlist to generate insights.", topMovers: [], sectorsInFocus: [] });
      return;
    }

    // Check caches
    if (!force) {
      if (feedType === 'global' && globalNewsCacheRef.current) {
        console.log("Using cached global news");
        setNews(globalNewsCacheRef.current.news);
        setMarketInsights(globalNewsCacheRef.current.insights);
        // Still fetch quotes in background
        FinanceAPI.fetchQuotes(tickers).then(setQuotes).catch(console.error);
        return;
      }
      
      if (feedType === 'portfolio' && portfolioNewsCacheRef.current) {
        const cachedTickers = portfolioNewsCacheRef.current.tickers;
        // Check if tickers are exactly the same
        if (cachedTickers.length === tickers.length && cachedTickers.every(t => tickers.includes(t))) {
          console.log("Using cached portfolio news");
          setNews(portfolioNewsCacheRef.current.news);
          setMarketInsights(portfolioNewsCacheRef.current.insights);
          // Still fetch quotes in background
          FinanceAPI.fetchQuotes(tickers).then(setQuotes).catch(console.error);
          return;
        }
      }
    }

    setIsLoadingNews(true);
    setError(null);
    try {
      // 1. Fetch raw news and quotes in parallel
      const [rawNews, fetchedQuotes] = await Promise.all([
        feedType === 'portfolio' ? FinanceAPI.fetchNews(tickers) : FinanceAPI.fetchGlobalNews(),
        FinanceAPI.fetchQuotes(tickers),
      ]);

      setQuotes(fetchedQuotes);

      // 2. Use existing profile
      let currentProfile = userProfile;

      // 3. Pass through Context-Aware Engine
      const enrichedNews = await contextualizeFeed(
        feedType === 'portfolio' ? tickers : [], 
        rawNews, 
        feedType !== 'portfolio',
        currentProfile
      );
      setNews(enrichedNews);

      // 4. Generate overall market mood
      setIsLoadingMood(true);
      
      const insights = await generateMarketMood(rawNews, currentProfile);
      setMarketInsights(insights);
      lastFetchRef.current[feedType] = Date.now();

      // Update caches
      if (feedType === 'global') {
        globalNewsCacheRef.current = { news: enrichedNews, insights };
      } else if (feedType === 'portfolio') {
        portfolioNewsCacheRef.current = { news: enrichedNews, insights, tickers: [...tickers] };
      }
    } catch (err: any) {
      console.error("Failed to fetch data", err);
      setError(err.message || "Failed to fetch real market data.");
    } finally {
      setIsLoadingNews(false);
      setIsLoadingMood(false);
    }
  }, [tickers, userProfile, user, feedType]);

  const refreshMoodOnly = useCallback(async () => {
    if (news.length === 0) return;
    setIsLoadingMood(true);
    try {
      const insights = await generateMarketMood(news, userProfile, true);
      setMarketInsights(insights);
      
      // Update caches with new insights
      if (feedType === 'global' && globalNewsCacheRef.current) {
        globalNewsCacheRef.current.insights = insights;
      } else if (feedType === 'portfolio' && portfolioNewsCacheRef.current) {
        portfolioNewsCacheRef.current.insights = insights;
      }
    } catch (err) {
      console.error("Failed to refresh market mood", err);
    } finally {
      setIsLoadingMood(false);
    }
  }, [news, userProfile, feedType]);

  const fetchPosts = useCallback(async () => {
    if (!supabase) return;
    try {
      let query = supabase
        .from("posts")
        .select(`
          *,
          likes_count:likes(count)
        `)
        .order("created_at", { ascending: false })
        .limit(20);

      if (feedType === 'following' && user) {
        if (followingUsers.length > 0) {
          query = query.in('user_id', followingUsers);
        } else {
          setPosts([]);
          return;
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching posts:", error);
      } else if (data) {
        // Now check which ones the user liked
        let likedPostIds: string[] = [];
        if (user) {
          const { data: userLikes } = await supabase
            .from('likes')
            .select('post_id')
            .eq('user_id', user.id);
          if (userLikes) {
            likedPostIds = userLikes.map(l => l.post_id.toString());
          }
        }

        const formattedPosts = data.map((post: any) => ({
          ...post,
          likes_count: post.likes_count?.[0]?.count || 0,
          is_liked: likedPostIds.includes(post.id.toString())
        }));
        setPosts(formattedPosts as Post[]);
      }
    } catch (err) {
      console.error("Failed to fetch posts:", err);
    }
  }, [user, feedType, followingUsers]);

  const fetchFollowing = useCallback(async () => {
    if (!supabase || !user) return;
    try {
      const { data, error } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id);
      
      if (error) throw error;
      if (data) {
        setFollowingUsers(prev => {
          const newIds = data.map(f => f.following_id);
          if (prev.length === newIds.length && prev.every((v, i) => v === newIds[i])) {
            return prev;
          }
          return newIds;
        });
      }
    } catch (err) {
      console.error("Error fetching following:", err);
    }
  }, [user]);

  const handlePostCreated = useCallback((newPost: Post) => {
    setPosts(prev => [{ ...newPost, likes_count: 0, is_liked: false }, ...prev]);
  }, []);

  const debouncedFetchNewsAndMood = useCallback((force = false) => {
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }
    fetchTimeoutRef.current = setTimeout(() => {
      fetchNewsAndMood(force);
      fetchPosts();
      fetchFollowing();
    }, 1000);
  }, [fetchNewsAndMood, fetchPosts, fetchFollowing]);

  // Initial fetch and polling
  useEffect(() => {
    debouncedFetchNewsAndMood(true);

    // Poll news and mood every 15 minutes (900000ms) to prevent Gemini API rate limits
    const newsInterval = setInterval(() => debouncedFetchNewsAndMood(true), 900000);

    return () => {
      clearInterval(newsInterval);
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch when feedType or tickers change
  useEffect(() => {
    debouncedFetchNewsAndMood(true);
  }, [feedType, tickers, debouncedFetchNewsAndMood]);

  // Load watchlist and profile from Supabase on mount or user change
  useEffect(() => {
    const fetchUserData = async () => {
      if (!supabase || !user) return;

      try {
        // Fetch Watchlist
        const { data: watchlistData, error: watchlistError } = await supabase
          .from("watchlists")
          .select("ticker")
          .eq("user_id", user.id);

        if (watchlistError) {
          console.error("Error fetching watchlist from Supabase:", watchlistError);
        } else if (watchlistData && watchlistData.length > 0) {
          setTickers(watchlistData.map((d) => d.ticker));
        }

        // Fetch Profile
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("risk_tolerance, preferred_sectors")
          .eq("id", user.id)
          .single();

        if (profileError && profileError.code === 'PGRST116') {
          // Create default profile if missing
          const { data: newProfile } = await supabase
            .from("profiles")
            .insert([{ id: user.id, risk_tolerance: 'Medium', preferred_sectors: [] }])
            .select()
            .single();
          
          if (newProfile) {
            setUserProfile({
              riskTolerance: newProfile.risk_tolerance || 'Medium',
              preferredSectors: newProfile.preferred_sectors || []
            });
          }
        } else if (profileData) {
          setUserProfile({
            riskTolerance: profileData.risk_tolerance || 'Medium',
            preferredSectors: profileData.preferred_sectors || []
          });
        }
        
        // Fetch Following
        const { data: followingData, error: followingError } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", user.id);
        
        if (followingError) {
          console.error("Error fetching following from Supabase:", followingError);
        } else if (followingData) {
          setFollowingUsers(followingData.map(f => f.following_id));
        }
      } catch (err) {
        console.error("Failed to connect to Supabase:", err);
      }
    };

    fetchUserData();
  }, [user]);

  const handleAddTicker = useCallback(async (ticker: string) => {
    if (!tickers.includes(ticker)) {
      setTickers((prev) => [...prev, ticker]);

      if (supabase && user) {
        try {
          await supabase
            .from("watchlists")
            .insert([{ ticker, user_id: user.id }]);
        } catch (err) {
          console.error("Failed to add ticker to Supabase:", err);
        }
      }
    }
  }, [tickers, user]);

  const handleRemoveTicker = useCallback(async (ticker: string) => {
    setTickers((prev) => prev.filter((t) => t !== ticker));

    if (supabase && user) {
      try {
        await supabase
          .from("watchlists")
          .delete()
          .eq("ticker", ticker)
          .eq("user_id", user.id);
      } catch (err) {
        console.error("Failed to remove ticker from Supabase:", err);
      }
    }
  }, [user]);

  const handleCloseProfile = useCallback(() => setIsProfileOpen(false), []);
  const handleCloseArticle = useCallback(() => setSelectedArticleUrl(null), []);
  const handleCloseTutorial = useCallback(() => {
    setShowTutorial(false);
    localStorage.setItem('hasSeenTutorial', 'true');
  }, []);
  const handleCloseAlerts = useCallback(() => setIsAlertsOpen(false), []);

  const filteredNews = useMemo(() => {
    return news.filter(item => {
      if (filterSentiment === 'All') return true;
      return item.sentiment === filterSentiment;
    });
  }, [news, filterSentiment]);

  const sortedNews = useMemo(() => {
    return [...filteredNews].sort((a, b) => {
      if (sortBy === 'relevance') {
        return (b.relevance_score || 0) - (a.relevance_score || 0);
      }
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [filteredNews, sortBy]);

  const feedItems = useMemo(() => {
    return [
      ...posts.map(p => ({ type: 'post' as const, data: p, time: new Date(p.created_at).getTime() })),
      ...sortedNews.map(n => ({ type: 'news' as const, data: n, time: new Date(n.timestamp).getTime() }))
    ].sort((a, b) => b.time - a.time);
  }, [posts, sortedNews]);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <Terminal className="text-blue-500 mb-4" size={32} />
          <div className="text-slate-400 font-mono text-sm tracking-widest">
            INITIALIZING SECURE TERMINAL...
          </div>
        </div>
      </div>
    );
  }

  // If Supabase is configured but user is not logged in, show Auth screen
  // If Supabase is NOT configured, we bypass auth and let them use the app locally
  if (supabase && !user) {
    return <Auth />;
  }

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-slate-200 font-sans overflow-hidden">
      {/* Top Navigation Bar */}
      <div className="h-14 bg-[#0a0a0c] border-b border-slate-800/80 flex items-center px-6 z-30 shadow-sm relative">
        <div className="flex items-center space-x-3 relative group/tooltip cursor-default">
          <div className="bg-blue-500/10 p-1.5 rounded-md border border-blue-500/20">
            <Terminal className="text-blue-400" size={18} />
          </div>
          <h1 className="font-mono font-bold tracking-widest text-sm uppercase">
            Terminal<span className="text-blue-500">.AI</span>
          </h1>
          <div className="absolute top-full mt-4 left-0 px-2 py-1 bg-[#1a1a1e] border border-slate-700 text-slate-300 text-[10px] font-mono whitespace-nowrap rounded shadow-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-50 pointer-events-none">
            Terminal.AI Dashboard
          </div>
        </div>

        <div className="ml-auto flex items-center space-x-4 lg:space-x-6 text-[10px] font-mono text-slate-500 uppercase tracking-widest">
          <div className="hidden lg:flex items-center space-x-2 relative group/tooltip cursor-help">
            <Radio
              size={12}
              className={
                isLoadingNews ? "text-blue-400 animate-pulse" : "text-slate-500"
              }
            />
            <span>{isLoadingNews ? "Receiving Data..." : "Stream Active"}</span>
            <div className="absolute top-full mt-4 right-0 px-2 py-1 bg-[#1a1a1e] border border-slate-700 text-slate-300 text-[10px] font-mono whitespace-nowrap rounded shadow-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-50 pointer-events-none">
              Data Stream Status
            </div>
          </div>

          {/* LIVE Pulse Icon */}
          <div 
            className="flex items-center space-x-2 bg-rose-500/10 px-3 py-1.5 rounded-full border border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.2)] cursor-help relative group/tooltip"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            </span>
            <span className="text-rose-400 font-bold tracking-widest">
              LIVE
            </span>
            <div className="absolute top-full mt-4 right-0 px-2 py-1 bg-[#1a1a1e] border border-slate-700 text-slate-300 text-[10px] font-mono whitespace-nowrap rounded shadow-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-50 pointer-events-none">
              Real-time data streaming active
            </div>
          </div>

          <div className="hidden lg:flex items-center space-x-2 bg-[#121214] px-3 py-1.5 rounded-md border border-slate-800 relative group/tooltip cursor-help">
            <span>SYS: {error ? "ERROR" : "ONLINE"}</span>
            <span
              className={`w-1.5 h-1.5 rounded-full ${error ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" : "bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]"}`}
            ></span>
            <div className="absolute top-full mt-4 right-0 px-2 py-1 bg-[#1a1a1e] border border-slate-700 text-slate-300 text-[10px] font-mono whitespace-nowrap rounded shadow-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-50 pointer-events-none">
              System Status
            </div>
          </div>

          {/* Database Status */}
          <div
            className="hidden lg:flex items-center space-x-2 bg-[#121214] px-3 py-1.5 rounded-md border border-slate-800 relative group/tooltip cursor-help"
          >
            <Database
              size={12}
              className={supabase ? "text-blue-400" : "text-slate-500"}
            />
            <span>DB: {supabase ? "SYNCED" : "LOCAL"}</span>
            <span
              className={`w-1.5 h-1.5 rounded-full ${supabase ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" : "bg-slate-500"}`}
            ></span>
            <div className="absolute top-full mt-4 right-0 px-2 py-1 bg-[#1a1a1e] border border-slate-700 text-slate-300 text-[10px] font-mono whitespace-nowrap rounded shadow-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-50 pointer-events-none">
              {supabase ? "Connected to Supabase" : "Using Local State (Connect Supabase in Settings)"}
            </div>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-md transition-colors flex items-center space-x-2 relative group/tooltip"
          >
            {theme === 'dark' && <Moon size={14} />}
            {theme === 'light' && <Sun size={14} />}
            {theme === 'high-contrast' && <Contrast size={14} />}
            <span className="hidden sm:inline">{theme}</span>
            <div className="absolute top-full mt-4 right-0 px-2 py-1 bg-[#1a1a1e] border border-slate-700 text-slate-300 text-[10px] font-mono whitespace-nowrap rounded shadow-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-50 pointer-events-none">
              Toggle Theme
            </div>
          </button>

          {/* User Profile / Logout */}
          {user && (
            <div className="flex items-center space-x-3 pl-4 border-l border-slate-800">
              <button
                onClick={() => setIsAlertsOpen(true)}
                className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-md transition-colors relative group/tooltip"
              >
                <Bell size={14} />
                {alerts.filter(a => !a.isTriggered).length > 0 && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                )}
                <div className="absolute top-full mt-4 right-0 px-2 py-1 bg-[#1a1a1e] border border-slate-700 text-slate-300 text-[10px] font-mono whitespace-nowrap rounded shadow-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-50 pointer-events-none">
                  Price Alerts
                </div>
              </button>
              <button
                onClick={() => setShowTutorial(true)}
                className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-md transition-colors relative group/tooltip"
              >
                <HelpCircle size={14} />
                <div className="absolute top-full mt-4 right-0 px-2 py-1 bg-[#1a1a1e] border border-slate-700 text-slate-300 text-[10px] font-mono whitespace-nowrap rounded shadow-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-50 pointer-events-none">
                  Tutorial
                </div>
              </button>
              <button 
                onClick={() => setIsProfileOpen(true)}
                className="flex items-center space-x-2 text-slate-300 hover:text-blue-400 transition-colors group relative group/tooltip"
              >
                <UserIcon size={14} className="text-slate-400 group-hover:text-blue-400 transition-colors" />
                <span className="truncate max-w-[120px]">
                  {user.email?.split("@")[0]}
                </span>
                <div className="absolute top-full mt-4 right-0 px-2 py-1 bg-[#1a1a1e] border border-slate-700 text-slate-300 text-[10px] font-mono whitespace-nowrap rounded shadow-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-50 pointer-events-none">
                  Profile Settings
                </div>
              </button>
              <button
                onClick={signOut}
                className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors relative group/tooltip"
              >
                <LogOut size={14} />
                <div className="absolute top-full mt-4 right-0 px-2 py-1 bg-[#1a1a1e] border border-slate-700 text-slate-300 text-[10px] font-mono whitespace-nowrap rounded shadow-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-50 pointer-events-none">
                  Sign Out
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-y-auto lg:overflow-hidden relative">
        {/* Background Grid */}
        <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none z-0"></div>

        <PortfolioSidebar
          tickers={tickers}
          quotes={quotes}
          onAddTicker={handleAddTicker}
          onRemoveTicker={handleRemoveTicker}
        />

        <main className="flex-1 flex flex-col min-h-[600px] lg:min-h-0 lg:h-full lg:overflow-hidden relative z-10">
          <div className="px-4 lg:px-6 py-4 bg-[#050505]/80 backdrop-blur-md border-b border-white/5 sticky top-0 z-10 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div className="flex items-center bg-[#121214] border border-slate-800/60 rounded-lg p-1 w-full sm:w-auto">
              <button
                onClick={() => setFeedType('global')}
                className={`flex-1 sm:flex-none px-4 py-1.5 text-[10px] font-mono font-semibold tracking-widest uppercase rounded-md transition-all ${
                  feedType === 'global' ? 'bg-blue-500/20 text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                }`}
              >
                Global
              </button>
              <button
                onClick={() => setFeedType('portfolio')}
                className={`flex-1 sm:flex-none px-4 py-1.5 text-[10px] font-mono font-semibold tracking-widest uppercase rounded-md transition-all ${
                  feedType === 'portfolio' ? 'bg-blue-500/20 text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                }`}
              >
                Portfolio
              </button>
              <button
                onClick={() => setFeedType('following')}
                className={`flex-1 sm:flex-none px-4 py-1.5 text-[10px] font-mono font-semibold tracking-widest uppercase rounded-md transition-all ${
                  feedType === 'following' ? 'bg-blue-500/20 text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                }`}
              >
                Following
              </button>
            </div>
            <div className="flex items-center space-x-2 lg:space-x-4 overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
              <div className="hidden md:flex items-center bg-[#121214] border border-slate-800 rounded p-0.5">
                {(['All', 'Bullish', 'Bearish', 'Noise'] as const).map(sentiment => (
                  <button
                    key={sentiment}
                    onClick={() => setFilterSentiment(sentiment)}
                    className={`px-3 py-1 text-[10px] font-mono uppercase tracking-widest rounded transition-colors ${
                      filterSentiment === sentiment 
                        ? 'bg-blue-500/20 text-blue-400' 
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {sentiment}
                  </button>
                ))}
              </div>
              <select
                value={filterSentiment}
                onChange={(e) => setFilterSentiment(e.target.value as 'All' | 'Bullish' | 'Bearish' | 'Noise')}
                className="md:hidden bg-[#121214] border border-slate-800 text-slate-300 text-[10px] font-mono rounded px-2 py-1 outline-none focus:border-blue-500/50 transition-colors uppercase tracking-widest cursor-pointer"
              >
                <option value="All">Filter: All</option>
                <option value="Bullish">Filter: Bullish</option>
                <option value="Bearish">Filter: Bearish</option>
                <option value="Noise">Filter: Noise</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'timestamp' | 'relevance')}
                className="bg-[#121214] border border-slate-800 text-slate-300 text-[10px] font-mono rounded px-2 py-1 outline-none focus:border-blue-500/50 transition-colors uppercase tracking-widest cursor-pointer"
              >
                <option value="timestamp">Sort: Time</option>
                <option value="relevance">Sort: Relevance</option>
              </select>
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest hidden sm:inline">
                {sortedNews.length} Events
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-6 space-y-4">
            <MarketDashboard />
            <CreatePost news={news} onPostCreated={handlePostCreated} />

            {error ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 font-mono text-xs uppercase tracking-widest border border-rose-500/30 bg-rose-500/5 rounded-xl m-4 p-8 text-center space-y-4">
                <AlertTriangle className="text-rose-400 mb-2" size={32} />
                <div className="text-rose-400 text-sm font-bold">
                  API Key Required
                </div>
                <div className="max-w-md leading-relaxed lowercase normal-case text-slate-300">
                  {error}
                </div>
                <div className="text-slate-500 mt-4 text-left bg-[#0a0a0c] p-4 rounded-lg border border-slate-800">
                  <div className="mb-2 text-slate-400">Setup Instructions:</div>
                  <ol className="list-decimal list-inside space-y-1 normal-case">
                    <li>
                      Get a free API key from{" "}
                      <a
                        href="https://finnhub.io"
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-400 hover:underline"
                      >
                        finnhub.io
                      </a>
                    </li>
                    <li>Open the AI Studio Settings (gear icon)</li>
                    <li>
                      Add{" "}
                      <span className="text-emerald-400 bg-emerald-400/10 px-1 rounded">
                        VITE_FINNHUB_API_KEY
                      </span>{" "}
                      to your environment variables
                    </li>
                    <li>Restart the dev server</li>
                  </ol>
                </div>
              </div>
            ) : isLoadingNews && news.length === 0 && posts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 font-mono text-xs uppercase tracking-widest space-y-4">
                <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                <span>Establishing secure connection...</span>
              </div>
            ) : news.length === 0 && posts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 font-mono text-xs uppercase tracking-widest border border-dashed border-slate-800 rounded-xl m-4">
                No market events or posts detected.
              </div>
            ) : sortedNews.length === 0 && posts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 font-mono text-xs uppercase tracking-widest border border-dashed border-slate-800 rounded-xl m-4">
                No events match the current filter.
              </div>
            ) : (
              <div className="max-w-4xl mx-auto space-y-4">
                {feedItems.map((item) => (
                  item.type === 'post' ? (
                    <PostCard 
                      key={`post-${item.data.id}`} 
                      post={item.data as Post} 
                      isFollowing={followingUsersSet.has((item.data as Post).user_id)}
                      onLikeUpdate={handleLikeUpdate}
                      onFollowUpdate={handleFollowUpdate}
                    />
                  ) : (
                    <SentimentCard 
                      key={`news-${item.data.id}`} 
                      item={item.data as EnrichedNewsItem} 
                      onArticleClick={setSelectedArticleUrl}
                    />
                  )
                ))}
              </div>
            )}
          </div>
        </main>

        <AIInsights
          insights={marketInsights}
          isLoading={isLoadingMood}
          onRefresh={fetchNewsAndMood}
          onRefreshMood={refreshMoodOnly}
        />
      </div>

      {/* Profile Settings Modal */}
      {isProfileOpen && (
        <ProfileSettings 
          isOpen={isProfileOpen} 
          onClose={handleCloseProfile} 
          onProfileUpdate={setUserProfile}
        />
      )}

      {/* Article Viewer Modal */}
      <ArticleModal 
        url={selectedArticleUrl} 
        onClose={handleCloseArticle} 
      />

      {/* Onboarding Tutorial */}
      <OnboardingTutorial
        isOpen={showTutorial}
        onClose={handleCloseTutorial}
      />

      {/* Alerts Manager */}
      <AlertsManager
        isOpen={isAlertsOpen}
        onClose={handleCloseAlerts}
        alerts={alerts}
        onAddAlert={handleAddAlert}
        onRemoveAlert={handleRemoveAlert}
        tickers={tickers}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
