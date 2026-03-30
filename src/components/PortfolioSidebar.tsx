import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, BarChart2, Search, Loader2 } from 'lucide-react';
import { Quote } from '../types';
import { FinanceAPI } from '../services/FinanceAPI';

interface PortfolioSidebarProps {
  tickers: string[];
  quotes: Record<string, Quote>;
  onAddTicker: (ticker: string) => void;
  onRemoveTicker: (ticker: string) => void;
}

const Sparkline = ({ quote }: { quote: Quote }) => {
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  if (!quote) return null;
  
  const isPositive = quote.changePercent >= 0;
  const color = isPositive ? '#10b981' : '#f43f5e'; // emerald-500 or rose-500
  
  // Create a 4-point sparkline using previous close, open, mid(high+low), and current
  // This gives a rough shape of the day's movement without needing historical candles
  const prevClose = quote.price - quote.change;
  const pts = [
    { x: 0, price: prevClose, label: 'Prev Close' },
    { x: 13, price: quote.price - (quote.change * 0.8), label: 'Open' },
    { x: 26, price: (quote.price + prevClose) / 2, label: 'Mid' },
    { x: 40, price: quote.price, label: 'Current' }
  ];
  
  const min = Math.min(...pts.map(p => p.price));
  const max = Math.max(...pts.map(p => p.price));
  const range = max - min || 1;
  
  // SVG dimensions: 40x24
  const getY = (val: number) => 20 - ((val - min) / range) * 16; 
  
  const points = pts.map(p => `${p.x},${getY(p.price)}`).join(' ');
  
  return (
    <div className="relative flex items-center justify-center w-[40px] h-[24px]">
      <svg width="40" height="24" className="overflow-visible opacity-60 group-hover:opacity-100 group-hover:scale-110 group-hover:drop-shadow-[0_0_4px_currentColor] transition-all duration-300">
        <polyline 
          points={points} 
          fill="none" 
          stroke={color} 
          strokeWidth="1.5" 
          className="group-hover:stroke-[2px] transition-all duration-300"
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={getY(p.price)}
            r="4"
            fill="transparent"
            className="cursor-pointer hover:fill-current transition-colors"
            onMouseEnter={() => setHoveredPoint(i)}
            onMouseLeave={() => setHoveredPoint(null)}
          />
        ))}
      </svg>
      {hoveredPoint !== null && (
        <div 
          className="absolute bottom-full mb-2 bg-slate-800 border border-slate-700 text-slate-200 text-[10px] px-2 py-1.5 rounded shadow-xl whitespace-nowrap z-50 pointer-events-none transform -translate-x-1/2 flex flex-col items-center gap-0.5"
          style={{ left: `${(pts[hoveredPoint].x / 40) * 100}%` }}
        >
          <span className="font-bold text-slate-400 text-[9px] uppercase tracking-wider">{pts[hoveredPoint].label}</span>
          <span className="font-mono">${pts[hoveredPoint].price.toFixed(2)}</span>
          {hoveredPoint > 0 && (
            <span className={`font-mono ${pts[hoveredPoint].price >= prevClose ? 'text-emerald-400' : 'text-rose-400'}`}>
              {pts[hoveredPoint].price >= prevClose ? '+' : ''}
              {((pts[hoveredPoint].price - prevClose) / prevClose * 100).toFixed(2)}%
            </span>
          )}
        </div>
      )}
    </div>
  );
};

const PriceAndChangeDisplay = ({ price, change, isPositive }: { price: number | string; change: string; isPositive: boolean }) => {
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const prevPriceRef = useRef(price);

  useEffect(() => {
    if (typeof price === 'number' && typeof prevPriceRef.current === 'number') {
      if (price > prevPriceRef.current) {
        setFlash('up');
      } else if (price < prevPriceRef.current) {
        setFlash('down');
      }
      
      const timer = setTimeout(() => setFlash(null), 1000);
      prevPriceRef.current = price;
      return () => clearTimeout(timer);
    }
    prevPriceRef.current = price;
  }, [price]);

  return (
    <div className="flex flex-col items-end w-20">
      <span className={`font-mono text-sm transition-colors duration-500 ${
        flash === 'up' ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 
        flash === 'down' ? 'text-rose-400 drop-shadow-[0_0_8px_rgba(251,113,133,0.8)]' : 
        'text-slate-300'
      }`}>
        ${typeof price === 'number' ? price.toFixed(2) : price}
      </span>
      <span className={`font-mono text-[10px] transition-colors duration-500 ${
        flash === 'up' ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 
        flash === 'down' ? 'text-rose-400 drop-shadow-[0_0_8px_rgba(251,113,133,0.8)]' : 
        (typeof price === 'string' ? 'text-slate-500' : isPositive ? 'text-emerald-400' : 'text-rose-400')
      }`}>
        {typeof price === 'number' && isPositive ? '+' : ''}{change}%
      </span>
    </div>
  );
};

const ElapsedTimeDisplay: React.FC<{ lastUpdated?: number }> = React.memo(({ lastUpdated }) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!lastUpdated) return <span className="text-[9px] text-slate-500 font-mono uppercase tracking-widest mt-1">N/A</span>;
  
  const seconds = Math.floor((now - lastUpdated) / 1000);
  let display = '0s ago';
  if (seconds >= 0) {
    if (seconds < 60) display = `${seconds}s ago`;
    else {
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) display = `${minutes}m ago`;
      else {
        const hours = Math.floor(minutes / 60);
        display = `${hours}h ago`;
      }
    }
  }

  return <span className="text-[9px] text-slate-500 font-mono uppercase tracking-widest mt-1">{display}</span>;
});

export const PortfolioSidebar: React.FC<PortfolioSidebarProps> = React.memo(({ tickers, quotes, onAddTicker, onRemoveTicker }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{symbol: string, description: string}[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.trim().length >= 1) {
        setIsSearching(true);
        const results = await FinanceAPI.searchSymbol(searchQuery);
        setSearchResults(results);
        setIsSearching(false);
        setShowDropdown(true);
      } else {
        setSearchResults([]);
        setShowDropdown(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim() && !tickers.includes(searchQuery.trim().toUpperCase())) {
      onAddTicker(searchQuery.trim().toUpperCase());
      setSearchQuery('');
      setShowDropdown(false);
    }
  };

  const handleSelectResult = (symbol: string) => {
    if (!tickers.includes(symbol)) {
      onAddTicker(symbol);
    }
    setSearchQuery('');
    setShowDropdown(false);
  };

  return (
    <div className="w-full lg:w-72 bg-[#0a0a0c]/90 backdrop-blur-xl border-b lg:border-b-0 lg:border-r border-white/5 flex flex-col h-auto lg:h-full z-20 relative shadow-[4px_0_24px_rgba(0,0,0,0.2)] shrink-0">
      <div className="p-4 lg:p-5 border-b border-white/5 flex items-center space-x-3 relative group/tooltip cursor-default">
        <div className="p-1.5 bg-blue-500/10 rounded-md border border-blue-500/20">
          <BarChart2 className="text-blue-400" size={16} />
        </div>
        <h2 className="text-slate-200 font-mono font-semibold tracking-widest uppercase text-xs">Watchlist</h2>
        <div className="absolute top-full mt-2 left-4 px-2 py-1 bg-[#1a1a1e] border border-slate-700 text-slate-300 text-[10px] font-mono whitespace-nowrap rounded shadow-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-50 pointer-events-none">
          Your Portfolio Watchlist
        </div>
      </div>

      {/* Search Bar Section - Fixed at top to avoid clipping */}
      <div className="p-4 border-b border-white/5 relative z-30">
        <div className="relative group" ref={dropdownRef}>
          <form onSubmit={handleAdd} className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="text-slate-500" size={14} />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery.trim() && setShowDropdown(true)}
              placeholder="SEARCH TICKER OR COMPANY..."
              className="w-full bg-[#121214] border border-slate-800 rounded-lg pl-9 pr-10 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 focus:bg-[#16161a] font-mono uppercase placeholder:text-slate-600 transition-all"
            />
            <button 
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-blue-400 bg-[#1a1a1e] p-1 rounded-md border border-slate-700/50 group-focus-within:border-blue-500/30 transition-all group/addbtn"
            >
              <Plus size={14} />
              <div className="absolute bottom-full mb-2 right-0 px-2 py-1 bg-[#1a1a1e] border border-slate-700 text-slate-300 text-[10px] font-mono whitespace-nowrap rounded shadow-xl opacity-0 invisible group-hover/addbtn:opacity-100 group-hover/addbtn:visible transition-all z-50 pointer-events-none">
                Add to Watchlist
              </div>
            </button>
          </form>

          {/* Autocomplete Dropdown */}
          {showDropdown && (searchQuery.trim().length > 0) && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#121214] border border-slate-800 rounded-lg shadow-xl overflow-hidden z-50 max-h-64 overflow-y-auto">
              {isSearching ? (
                <div className="flex items-center justify-center p-4 text-slate-500">
                  <Loader2 size={16} className="animate-spin" />
                </div>
              ) : searchResults.length > 0 ? (
                <div>
                  {searchResults.map((result) => (
                    <button
                      key={result.symbol}
                      onClick={() => handleSelectResult(result.symbol)}
                      className="w-full text-left px-4 py-3 hover:bg-[#1a1a1e] border-b border-slate-800/50 last:border-0 transition-colors flex flex-col"
                    >
                      <span className="font-mono font-bold text-sm text-slate-200">{result.symbol}</span>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider truncate">{result.description}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-xs font-mono text-slate-500 uppercase">
                  No results found
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      <div className="p-4 flex-1 overflow-y-auto max-h-64 lg:max-h-none">
        <div className="space-y-2">
          {tickers.map(ticker => {
            const data = quotes[ticker];
            const price = data ? data.price.toFixed(2) : '---';
            const change = data ? data.changePercent.toFixed(2) : '---';
            const isPositive = data ? data.changePercent >= 0 : true;

            return (
              <div key={ticker} className="flex items-center justify-between bg-[#121214] hover:bg-[#1e1e24] px-3 py-3 rounded-lg border border-slate-800/60 group hover:border-slate-700 transition-all duration-300 relative overflow-hidden">
                <div className="flex flex-col w-20">
                  <span className="font-mono font-bold text-sm text-slate-200">{ticker}</span>
                  <div className="font-mono text-[9px] text-slate-500 relative group/time cursor-help">
                    <ElapsedTimeDisplay lastUpdated={data?.lastUpdated} />
                    <div className="absolute bottom-full mb-1 left-0 px-2 py-1 bg-[#1a1a1e] border border-slate-700 text-slate-300 text-[10px] font-mono whitespace-nowrap rounded shadow-xl opacity-0 invisible group-hover/time:opacity-100 group-hover/time:visible transition-all z-50 pointer-events-none">
                      Last updated
                    </div>
                  </div>
                </div>
                
                {/* Sparkline Chart */}
                <div className="flex-1 flex justify-center px-1">
                  {data && <Sparkline quote={data} />}
                </div>
                
                <PriceAndChangeDisplay price={data ? data.price : '---'} change={change} isPositive={isPositive} />

                <div className="absolute inset-y-0 right-0 flex items-center pr-3 bg-gradient-to-l from-[#121214] via-[#121214] to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => onRemoveTicker(ticker)}
                    className="text-slate-500 hover:text-rose-400 bg-[#1a1a1e] p-1.5 rounded-md border border-slate-700/50 relative group/rmbtn"
                  >
                    <X size={12} />
                    <div className="absolute bottom-full mb-2 right-0 px-2 py-1 bg-[#1a1a1e] border border-slate-700 text-slate-300 text-[10px] font-mono whitespace-nowrap rounded shadow-xl opacity-0 invisible group-hover/rmbtn:opacity-100 group-hover/rmbtn:visible transition-all z-50 pointer-events-none">
                      Remove Ticker
                    </div>
                  </button>
                </div>
              </div>
            );
          })}
          {tickers.length === 0 && (
            <div className="text-center text-slate-600 font-mono text-xs py-8 border border-dashed border-slate-800 rounded-lg">
              WATCHLIST EMPTY
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
