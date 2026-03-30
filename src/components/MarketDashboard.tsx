import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Globe, Coins, RefreshCw, Loader2 } from 'lucide-react';
import { fetchMarketDashboardData, MarketDashboardData } from '../services/geminiService';

export const MarketDashboard: React.FC = () => {
  const [data, setData] = useState<MarketDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const result = await fetchMarketDashboardData();
      setData(result);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Failed to fetch dashboard data", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Poll every 30 minutes (1800000ms) to be more conservative with Gemini API quota
    const interval = setInterval(fetchData, 1800000); 
    return () => clearInterval(interval);
  }, []);

  const formatPrice = (price: number, symbol: string = '$', isFiat: boolean = false) => {
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: price < 1 && !isFiat ? 6 : 2,
    }).format(price);
    
    return isFiat ? `${formatted} ${symbol}` : `${symbol}${formatted}`;
  };

  const ChangeIndicator = ({ change }: { change: number }) => {
    const isPositive = change >= 0;
    return (
      <span className={`flex items-center gap-1 font-mono text-[10px] ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
        {isPositive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
        [{isPositive ? '+' : ''}{change.toFixed(1)}%]
      </span>
    );
  };

  return (
    <div className="bg-[#0a0a0c] border border-slate-800/80 rounded-xl overflow-hidden mb-6">
      <div className="bg-slate-900/50 px-4 py-2 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe size={14} className="text-blue-400" />
          <h2 className="text-[11px] font-mono uppercase tracking-widest text-slate-300">Global Market Monitor</h2>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[9px] font-mono text-slate-500">
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button 
            onClick={fetchData} 
            disabled={isLoading}
            className="text-slate-400 hover:text-white transition-colors"
          >
            {isLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800">
        {/* Crypto Section */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Coins size={14} className="text-amber-400" />
            <h3 className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Cryptocurrencies</h3>
          </div>
          <div className="space-y-2">
            {data?.crypto.map((item) => (
              <div key={item.symbol} className="flex items-center justify-between group">
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-slate-200">{item.name}</span>
                  <span className="text-[9px] font-mono text-slate-500 uppercase">{item.symbol}</span>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono text-slate-200">{formatPrice(item.price)}</div>
                  <ChangeIndicator change={item.change24h} />
                </div>
              </div>
            )) || (
              <div className="animate-pulse space-y-2">
                {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-8 bg-slate-900/50 rounded" />)}
              </div>
            )}
          </div>
        </div>

        {/* Fiat Section */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Globe size={14} className="text-emerald-400" />
            <h3 className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Fiat Exchange (vs USD)</h3>
          </div>
          <div className="space-y-2">
            {data?.fiat.map((item) => (
              <div key={item.symbol} className="flex items-center justify-between group">
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-slate-200">{item.name}</span>
                  <span className="text-[9px] font-mono text-slate-500 uppercase">{item.symbol}</span>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono text-slate-200">
                    {formatPrice(item.rate, item.currencySymbol, true)}
                  </div>
                  <ChangeIndicator change={item.change24h} />
                </div>
              </div>
            )) || (
              <div className="animate-pulse space-y-2">
                {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-8 bg-slate-900/50 rounded" />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
