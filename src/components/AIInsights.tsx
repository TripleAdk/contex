import React, { useState } from 'react';
import { Sparkles, RefreshCw, Cpu, TrendingUp, Briefcase, ThumbsUp, ThumbsDown, Check, Terminal } from 'lucide-react';
import { motion } from 'motion/react';
import { MarketInsights } from '../services/geminiService';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface AIInsightsProps {
  insights: MarketInsights | null;
  isLoading: boolean;
  onRefresh: () => void;
  onRefreshMood?: () => void;
}

export const AIInsights: React.FC<AIInsightsProps> = React.memo(({ insights, isLoading, onRefresh, onRefreshMood }) => {
  const { user } = useAuth();
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);

  const handleFeedback = async (type: 'up' | 'down') => {
    setFeedback(type);
    console.log(`[Analytics] AI Briefing Feedback: ${type}`);

    if (supabase && user) {
      try {
        await supabase.from('ai_feedback').insert([{
          user_id: user.id,
          feedback_type: 'briefing',
          sentiment: type
        }]);
      } catch (err) {
        console.warn('Failed to log feedback to Supabase:', err);
      }
    }
  };

  return (
    <div className="w-full lg:w-80 bg-[#0a0a0c]/90 backdrop-blur-xl border-t lg:border-t-0 lg:border-l border-white/5 flex flex-col h-auto lg:h-full z-20 relative shadow-[-4px_0_24px_rgba(0,0,0,0.2)] shrink-0">
      <div className="p-4 lg:p-5 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-1.5 bg-purple-500/10 rounded-md border border-purple-500/20 relative">
            <Cpu className="text-purple-400" size={16} />
            {isLoading && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-purple-400 rounded-full animate-ping" />
            )}
          </div>
          <h2 className="text-slate-200 font-mono font-semibold tracking-widest uppercase text-xs">AI Briefing</h2>
        </div>
        <button 
          onClick={onRefresh}
          disabled={isLoading}
          title="Refresh All Data"
          className="text-slate-500 hover:text-purple-400 disabled:opacity-50 transition-colors p-1.5 hover:bg-purple-500/10 rounded-md"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin text-purple-400' : ''} />
        </button>
      </div>
      
      <div className="p-4 lg:p-5 flex-1 overflow-y-auto max-h-80 lg:max-h-none space-y-6">
        <div className="relative group">
          {/* Glowing background effect */}
          <div className="absolute -inset-0.5 bg-gradient-to-b from-purple-500/20 to-blue-500/20 rounded-xl blur opacity-30 group-hover:opacity-50 transition duration-1000"></div>
          
          <div className="relative bg-[#121214] border border-slate-700/50 rounded-xl p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Sparkles className="text-purple-400" size={14} />
                <h3 className="text-[10px] font-mono text-purple-400 uppercase tracking-widest">Personalized Strategy</h3>
              </div>
              {onRefreshMood && (
                <button 
                  onClick={onRefreshMood}
                  disabled={isLoading}
                  title="Refresh AI Insights Only"
                  className="text-slate-500 hover:text-purple-400 disabled:opacity-50 transition-colors p-1 hover:bg-purple-500/10 rounded-md"
                >
                  <RefreshCw size={12} className={isLoading ? 'animate-spin text-purple-400' : ''} />
                </button>
              )}
            </div>
            
            {isLoading ? (
              <div className="space-y-3">
                <div className="h-2 bg-slate-800/80 rounded w-full animate-pulse"></div>
                <div className="h-2 bg-slate-800/80 rounded w-5/6 animate-pulse" style={{ animationDelay: '150ms' }}></div>
                <div className="h-2 bg-slate-800/80 rounded w-4/6 animate-pulse" style={{ animationDelay: '300ms' }}></div>
                <div className="h-2 bg-slate-800/80 rounded w-full animate-pulse" style={{ animationDelay: '450ms' }}></div>
                <div className="pt-4 flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  <span className="text-[10px] font-mono text-purple-500/70 ml-2 uppercase tracking-widest">Processing...</span>
                </div>
              </div>
            ) : (
              <motion.div 
                key={insights?.mood || 'empty'}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="text-slate-300 text-sm leading-relaxed font-light"
              >
                {insights?.mood || "No insights available."}
              </motion.div>
            )}
          </div>
        </div>

        {/* Top Movers Section */}
        {isLoading ? (
          <div className="border border-slate-800/60 rounded-lg p-4 bg-[#121214]">
            <div className="flex items-center space-x-2 mb-3">
              <TrendingUp className="text-emerald-400/50" size={14} />
              <h3 className="text-[10px] font-mono text-emerald-400/50 uppercase tracking-widest">Top Movers</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="h-6 w-16 bg-slate-800/80 rounded animate-pulse"></div>
              <div className="h-6 w-20 bg-slate-800/80 rounded animate-pulse" style={{ animationDelay: '150ms' }}></div>
              <div className="h-6 w-14 bg-slate-800/80 rounded animate-pulse" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        ) : (insights?.topMovers && insights.topMovers.length > 0) && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="border border-slate-800/60 rounded-lg p-4 bg-[#121214]"
          >
            <div className="flex items-center space-x-2 mb-3">
              <TrendingUp className="text-emerald-400" size={14} />
              <h3 className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest">Top Movers</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {insights.topMovers.map((mover, idx) => (
                <span key={idx} className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded text-xs font-mono">
                  {mover}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Sectors in Focus Section */}
        {isLoading ? (
          <div className="border border-slate-800/60 rounded-lg p-4 bg-[#121214]">
            <div className="flex items-center space-x-2 mb-3">
              <Briefcase className="text-blue-400/50" size={14} />
              <h3 className="text-[10px] font-mono text-blue-400/50 uppercase tracking-widest">Sectors in Focus</h3>
            </div>
            <div className="flex flex-col space-y-3">
              <div className="flex items-center space-x-2">
                <div className="w-1 h-1 bg-slate-700 rounded-full"></div>
                <div className="h-3 w-24 bg-slate-800/80 rounded animate-pulse"></div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-1 h-1 bg-slate-700 rounded-full"></div>
                <div className="h-3 w-32 bg-slate-800/80 rounded animate-pulse" style={{ animationDelay: '150ms' }}></div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-1 h-1 bg-slate-700 rounded-full"></div>
                <div className="h-3 w-20 bg-slate-800/80 rounded animate-pulse" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        ) : (insights?.sectorsInFocus && insights.sectorsInFocus.length > 0) && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="border border-slate-800/60 rounded-lg p-4 bg-[#121214]"
          >
            <div className="flex items-center space-x-2 mb-3">
              <Briefcase className="text-blue-400" size={14} />
              <h3 className="text-[10px] font-mono text-blue-400 uppercase tracking-widest">Sectors in Focus</h3>
            </div>
            <div className="flex flex-col space-y-2">
              {insights.sectorsInFocus.map((sector, idx) => (
                <div key={idx} className="flex items-center space-x-2">
                  <div className="w-1 h-1 bg-blue-400 rounded-full"></div>
                  <span className="text-slate-300 text-xs font-medium">{sector}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
        
        <div className="border border-slate-800/60 rounded-lg p-4 bg-[#0a0a0c] shadow-inner relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500/0 via-blue-500/20 to-blue-500/0"></div>
           <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3 flex items-center">
             <Terminal size={12} className="mr-1.5 text-slate-400" />
             System Status
           </h3>
           <div className="space-y-2">
             <div className="flex justify-between items-center text-xs font-mono">
               <span className="text-slate-400">Model</span>
               <span className="text-blue-400 font-semibold">Gemini 3.0 Flash</span>
             </div>
             <div className="flex justify-between items-center text-xs font-mono">
               <span className="text-slate-400">Latency</span>
               <span className="text-emerald-400">~1.2s</span>
             </div>
             <div className="flex justify-between items-center text-xs font-mono">
               <span className="text-slate-400">Data Source</span>
               <span className="text-slate-200">Finnhub / Reddit</span>
             </div>
           </div>
        </div>

        {/* Feedback Mechanism for Evaluation */}
        {!isLoading && insights && (
          <div className="mt-6 pt-5 border-t border-slate-800/60">
            {feedback ? (
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-center space-x-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3"
              >
                <Check size={14} className="text-emerald-400" />
                <span className="text-xs text-emerald-400/90 font-mono tracking-wide">
                  Feedback recorded
                </span>
              </motion.div>
            ) : (
              <div className="flex flex-col items-center space-y-3 bg-[#0a0a0c] border border-slate-800/60 rounded-lg p-4">
                <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest text-center">
                  Did this briefing help your decision making?
                </p>
                <div className="flex space-x-3 w-full">
                  <button 
                    onClick={() => handleFeedback('up')} 
                    className="flex-1 flex justify-center items-center p-2 bg-slate-800/30 hover:bg-emerald-500/10 hover:text-emerald-400 text-slate-400 rounded-md transition-colors border border-slate-700/50 hover:border-emerald-500/30 group"
                    title="Yes, this was helpful"
                  >
                    <ThumbsUp size={16} className="group-hover:scale-110 transition-transform" />
                  </button>
                  <button 
                    onClick={() => handleFeedback('down')} 
                    className="flex-1 flex justify-center items-center p-2 bg-slate-800/30 hover:bg-rose-500/10 hover:text-rose-400 text-slate-400 rounded-md transition-colors border border-slate-700/50 hover:border-rose-500/30 group"
                    title="No, this was not helpful"
                  >
                    <ThumbsDown size={16} className="group-hover:scale-110 transition-transform" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
