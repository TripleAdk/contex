import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X, Plus, Loader2, Check, TrendingUp, Globe } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';

// Static Data for Suggestions
const NGX_TICKERS = [
  { symbol: 'DANGCEM', name: 'Dangote Cement Plc' },
  { symbol: 'MTNN', name: 'MTN Nigeria Communications Plc' },
  { symbol: 'ZENITHBANK', name: 'Zenith Bank Plc' },
  { symbol: 'GTCO', name: 'Guaranty Trust Holding Company Plc' },
  { symbol: 'SEPLAT', name: 'Seplat Energy Plc' },
  { symbol: 'NESTLE', name: 'Nestle Nigeria Plc' },
  { symbol: 'STANBIC', name: 'Stanbic IBTC Holdings Plc' },
  { symbol: 'FBNH', name: 'FBN Holdings Plc' },
  { symbol: 'UBA', name: 'United Bank for Africa Plc' },
  { symbol: 'ACCESS', name: 'Access Holdings Plc' },
];

const GLOBAL_TICKERS = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corp.' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.' },
  { symbol: 'TSLA', name: 'Tesla Inc.' },
  { symbol: 'META', name: 'Meta Platforms Inc.' },
  { symbol: 'BTC', name: 'Bitcoin' },
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'SOL', name: 'Solana' },
];

const ALL_TICKERS = [...NGX_TICKERS, ...GLOBAL_TICKERS];

interface TickerManagerProps {
  initialWatchlist?: { id: string; ticker: string }[];
  onWatchlistChange?: (watchlist: { id: string; ticker: string }[]) => void;
}

export const TickerManager: React.FC<TickerManagerProps> = ({ initialWatchlist = [], onWatchlistChange }) => {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [watchlist, setWatchlist] = useState<{ id: string; ticker: string }[]>(initialWatchlist);
  const [isFocused, setIsFocused] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'synced' | 'error'>('idle');
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync initial watchlist if provided
  useEffect(() => {
    if (initialWatchlist.length > 0 && watchlist.length === 0) {
      setWatchlist(initialWatchlist);
    }
  }, [initialWatchlist]);

  // Smart Suggestion Engine
  const suggestions = useMemo(() => {
    if (!debouncedQuery.trim()) return [];
    
    const lowerQuery = debouncedQuery.toLowerCase();
    return ALL_TICKERS.filter(t => 
      t.symbol.toLowerCase().includes(lowerQuery) || 
      t.name.toLowerCase().includes(lowerQuery)
    ).filter(t => !watchlist.some(w => w.ticker === t.symbol)); // Exclude already added
  }, [debouncedQuery, watchlist]);

  const recommendedTickers = useMemo(() => {
    // Show recommendations if watchlist is empty or small
    const recommended = ALL_TICKERS.filter(t => !watchlist.some(w => w.ticker === t.symbol));
    // Mix of NGX and Global
    return [
      ...recommended.filter(t => NGX_TICKERS.some(n => n.symbol === t.symbol)).slice(0, 3),
      ...recommended.filter(t => GLOBAL_TICKERS.some(g => g.symbol === t.symbol)).slice(0, 3)
    ];
  }, [watchlist]);

  const handleAddTicker = async (tickerSymbol: string) => {
    if (!user || !supabase) return;
    
    const upperTicker = tickerSymbol.toUpperCase().trim();
    
    // Validate custom input pattern (1-10 uppercase letters/numbers, optional dot/dash)
    const isValidPattern = /^[A-Z0-9.\-]{1,10}$/.test(upperTicker);
    if (!isValidPattern) {
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 3000);
      return;
    }

    if (watchlist.some(w => w.ticker === upperTicker)) {
      setQuery('');
      return;
    }

    setSyncStatus('saving');
    const tempId = `temp-${Date.now()}`;
    const newItem = { id: tempId, ticker: upperTicker };
    
    // Optimistic UI update
    const newWatchlist = [...watchlist, newItem];
    setWatchlist(newWatchlist);
    setQuery('');
    if (onWatchlistChange) onWatchlistChange(newWatchlist);

    try {
      // Use upsert as requested
      const { data, error } = await supabase
        .from('watchlists')
        .upsert({ 
          user_id: user.id, 
          ticker: upperTicker 
        }, { onConflict: 'user_id,ticker' })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const updatedWatchlist = newWatchlist.map(item => 
          item.id === tempId ? { id: data.id, ticker: data.ticker } : item
        );
        setWatchlist(updatedWatchlist);
        if (onWatchlistChange) onWatchlistChange(updatedWatchlist);
      }
      
      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 2000);
    } catch (err) {
      console.error('Error adding ticker:', err);
      // Revert optimistic update
      const revertedWatchlist = watchlist.filter(item => item.id !== tempId);
      setWatchlist(revertedWatchlist);
      if (onWatchlistChange) onWatchlistChange(revertedWatchlist);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  };

  const handleRemoveTicker = async (id: string, tickerToRemove: string) => {
    if (!user || !supabase) return;

    setSyncStatus('saving');
    
    // Optimistic UI update
    const previousWatchlist = [...watchlist];
    const newWatchlist = watchlist.filter(item => item.id !== id);
    setWatchlist(newWatchlist);
    if (onWatchlistChange) onWatchlistChange(newWatchlist);

    try {
      const { error } = await supabase
        .from('watchlists')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      
      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 2000);
    } catch (err) {
      console.error('Error removing ticker:', err);
      // Revert optimistic update
      setWatchlist(previousWatchlist);
      if (onWatchlistChange) onWatchlistChange(previousWatchlist);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && query.trim()) {
      e.preventDefault();
      handleAddTicker(query);
    }
  };

  return (
    <div className="w-full space-y-4" ref={wrapperRef}>
      {/* Header & Sync Status */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-mono text-slate-400 uppercase tracking-wider flex items-center space-x-2">
          <TrendingUp size={14} />
          <span>Manage Watchlist</span>
        </label>
        
        <div className="flex items-center space-x-2 text-[10px] font-mono uppercase tracking-wider">
          {syncStatus === 'saving' && (
            <span className="text-blue-400 flex items-center space-x-1">
              <Loader2 size={10} className="animate-spin" />
              <span>Saving...</span>
            </span>
          )}
          {syncStatus === 'synced' && (
            <span className="text-emerald-400 flex items-center space-x-1">
              <Check size={10} />
              <span>Synced</span>
            </span>
          )}
          {syncStatus === 'error' && (
            <span className="text-rose-400 flex items-center space-x-1">
              <X size={10} />
              <span>Sync Failed</span>
            </span>
          )}
        </div>
      </div>

      {/* Selected Tickers (Pills/Chips) */}
      <div className="flex flex-wrap gap-2 min-h-[32px]">
        <AnimatePresence>
          {watchlist.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center space-x-1 bg-[#1a1a1e] border border-slate-700/50 rounded-full px-3 py-1.5 group hover:border-slate-600 transition-colors"
            >
              <span className="text-xs font-mono text-slate-200 font-semibold">{item.ticker}</span>
              <button
                onClick={() => handleRemoveTicker(item.id, item.ticker)}
                className="text-slate-500 hover:text-rose-400 transition-colors p-0.5 rounded-full hover:bg-rose-500/10"
                title="Remove ticker"
              >
                <X size={12} />
              </button>
            </motion.div>
          ))}
          {watchlist.length === 0 && (
            <span className="text-sm text-slate-500 italic py-1">No tickers added yet.</span>
          )}
        </AnimatePresence>
      </div>

      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search size={16} className="text-slate-500" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search NGX or Global tickers (e.g., DANGCEM, AAPL)"
          className="w-full bg-[#121214] border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 focus:bg-[#16161a] transition-all placeholder:text-slate-600"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
          >
            <X size={14} />
          </button>
        )}

        {/* Dropdown Suggestions */}
        <AnimatePresence>
          {isFocused && (query.trim() || watchlist.length < 3) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute z-10 w-full mt-2 bg-[#121214] border border-slate-800 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto custom-scrollbar"
            >
              {query.trim() ? (
                // Search Results
                <div className="p-2">
                  <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-slate-500">
                    Search Results
                  </div>
                  {suggestions.length > 0 ? (
                    suggestions.map((t) => (
                      <button
                        key={t.symbol}
                        onClick={() => handleAddTicker(t.symbol)}
                        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/5 rounded-lg transition-colors text-left group"
                      >
                        <div className="flex flex-col">
                          <span className="text-sm font-mono font-semibold text-slate-200 group-hover:text-blue-400 transition-colors">
                            {t.symbol}
                          </span>
                          <span className="text-xs text-slate-500 truncate max-w-[200px]">
                            {t.name}
                          </span>
                        </div>
                        <Plus size={16} className="text-slate-600 group-hover:text-blue-400" />
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-4 text-center">
                      <p className="text-sm text-slate-400 mb-2">No exact matches found.</p>
                      <button
                        onClick={() => handleAddTicker(query)}
                        className="text-xs font-mono bg-blue-500/10 text-blue-400 border border-blue-500/30 px-4 py-2 rounded-lg hover:bg-blue-500/20 transition-colors flex items-center justify-center space-x-2 w-full"
                      >
                        <Globe size={14} />
                        <span>Add "{query.toUpperCase()}" as Custom Ticker</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                // Empty State / Recommendations
                <div className="p-2">
                  <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-slate-500 flex items-center space-x-2">
                    <TrendingUp size={12} />
                    <span>Recommended for You</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {recommendedTickers.map((t) => (
                      <button
                        key={t.symbol}
                        onClick={() => handleAddTicker(t.symbol)}
                        className="flex items-center justify-between px-3 py-2.5 hover:bg-white/5 rounded-lg transition-colors text-left group"
                      >
                        <div className="flex flex-col overflow-hidden">
                          <span className="text-sm font-mono font-semibold text-slate-200 group-hover:text-emerald-400 transition-colors">
                            {t.symbol}
                          </span>
                          <span className="text-[10px] text-slate-500 truncate">
                            {t.name}
                          </span>
                        </div>
                        <Plus size={14} className="text-slate-600 group-hover:text-emerald-400 shrink-0 ml-2" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
