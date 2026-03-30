import React, { useState, useEffect, useRef } from 'react';
import { EnrichedNewsItem, NewsItem } from '../types';
import { TrendingUp, TrendingDown, Minus, ExternalLink, Zap, Sparkles, ChevronDown, ChevronUp, Link as LinkIcon, FileText, Loader2, Share2, Twitter, Linkedin, Copy, Check, Heart, RefreshCw, ThumbsUp, ThumbsDown, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FinanceAPI } from '../services/FinanceAPI';
import { summarizeNewsItem } from '../services/geminiService';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface SentimentCardProps {
  item: EnrichedNewsItem;
  onArticleClick?: (url: string) => void;
}

export const SentimentCard: React.FC<SentimentCardProps> = React.memo(({ item, onArticleClick }) => {
  const { user } = useAuth();
  const [relatedArticles, setRelatedArticles] = useState<NewsItem[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoadingRelated, setIsLoadingRelated] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isLiked, setIsLiked] = useState(item.is_liked || false);
  const [likesCount, setLikesCount] = useState(item.likes_count || 0);
  const [isLiking, setIsLiking] = useState(false);
  const [summaryFeedback, setSummaryFeedback] = useState<'up' | 'down' | null>(null);
  const shareRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(event.target as Node)) {
        setIsShareOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSummarize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (summary || isSummarizing) return;
    
    setIsSummarizing(true);
    try {
      const generatedSummary = await summarizeNewsItem(item);
      setSummary(generatedSummary);
    } catch (error) {
      console.error("Failed to generate summary:", error);
      setSummary("Failed to generate summary.");
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleRegenerateSummary = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSummarizing) return;
    
    setIsSummarizing(true);
    setSummaryFeedback(null); // Reset feedback on regenerate
    try {
      const generatedSummary = await summarizeNewsItem(item);
      setSummary(generatedSummary);
    } catch (error) {
      console.error("Failed to regenerate summary:", error);
      setSummary("Failed to regenerate summary.");
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleSummaryFeedback = async (e: React.MouseEvent, type: 'up' | 'down') => {
    e.stopPropagation();
    setSummaryFeedback(type);
    console.log(`[Analytics] Summary Feedback for ${item.id}: ${type}`);

    if (supabase && user) {
      try {
        await supabase.from('ai_feedback').insert([{
          user_id: user.id,
          feedback_type: 'summary',
          item_id: item.id,
          sentiment: type
        }]);
      } catch (err) {
        console.warn('Failed to log feedback to Supabase:', err);
      }
    }
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || isLiking) return;

    setIsLiking(true);
    const newIsLiked = !isLiked;
    const newCount = isLiked ? Math.max(0, likesCount - 1) : likesCount + 1;

    // Optimistic update
    setIsLiked(newIsLiked);
    setLikesCount(newCount);

    try {
      if (supabase) {
        if (isLiked) {
          await supabase
            .from('article_likes')
            .delete()
            .eq('article_id', item.id)
            .eq('user_id', user.id);
        } else {
          await supabase
            .from('article_likes')
            .insert([{ article_id: item.id, user_id: user.id }]);
        }
      }
    } catch (err) {
      console.warn('Could not persist article like to DB, using local state only:', err);
    } finally {
      setIsLiking(false);
    }
  };

  useEffect(() => {
    if (isExpanded && relatedArticles.length === 0) {
      const fetchRelated = async () => {
        setIsLoadingRelated(true);
        try {
          const news = await FinanceAPI.fetchNews([item.ticker]);
          // Filter out the current article and take up to 10
          const related = news.filter(n => n.id !== item.id).slice(0, 10);
          setRelatedArticles(related);
        } catch (error) {
          console.error("Failed to fetch related articles:", error);
        } finally {
          setIsLoadingRelated(false);
        }
      };
      
      fetchRelated();
    }
  }, [isExpanded, item.ticker, item.id, relatedArticles.length]);
  const getSentimentConfig = () => {
    switch (item.sentiment) {
      case 'Bullish': return { color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-500/30', leftBorder: 'border-l-emerald-500', icon: <TrendingUp size={14} className="mr-1.5" /> };
      case 'Bearish': return { color: 'text-rose-400', bg: 'bg-rose-400/10', border: 'border-rose-500/30', leftBorder: 'border-l-rose-500', icon: <TrendingDown size={14} className="mr-1.5" /> };
      default: return { color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-600/30', leftBorder: 'border-l-slate-600', icon: <Minus size={14} className="mr-1.5" /> };
    }
  };

  const config = getSentimentConfig();

  const timeAgo = (dateInput: Date | string) => {
    const date = new Date(dateInput);
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    let interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + 'h ago';
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + 'm ago';
    return Math.floor(seconds) + 's ago';
  };

  const getRelevanceColor = (score: number) => {
    if (score >= 0.8) return 'text-purple-400';
    if (score >= 0.5) return 'text-blue-400';
    return 'text-slate-400';
  };

  const handleCardClick = () => {
    // Don't navigate if clicking inside the share dropdown
    if (isShareOpen) return;
    
    if (item.url) {
      if (onArticleClick) {
        onArticleClick(item.url);
      } else {
        window.open(item.url, '_blank', 'noopener,noreferrer');
      }
    }
  };

  const handleShare = (e: React.MouseEvent, platform: string) => {
    e.stopPropagation();
    
    if (!item.url) return;

    if (platform === 'copy') {
      navigator.clipboard.writeText(item.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else if (platform === 'Twitter') {
      const text = `Check out this news about ${item.ticker}: ${item.headline}`;
      const twitterUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(item.url)}&text=${encodeURIComponent(text)}`;
      window.open(twitterUrl, '_blank', 'noopener,noreferrer');
      setIsShareOpen(false);
    } else if (platform === 'LinkedIn') {
      const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(item.url)}`;
      window.open(linkedinUrl, '_blank', 'noopener,noreferrer');
      setIsShareOpen(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={handleCardClick}
      className={`bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] border-l-4 ${config.leftBorder} rounded-xl p-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] hover:bg-white/[0.06] transition-all group relative overflow-hidden ${item.url ? 'cursor-pointer' : ''}`}
    >
      {/* Subtle glass reflection */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center space-x-3">
          <span className="font-mono font-bold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded text-xs tracking-wide border border-blue-400/20">
            {item.ticker}
          </span>
          <span className="text-[11px] text-slate-500 font-mono tracking-wider uppercase">{timeAgo(item.timestamp)}</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="relative group/tooltip">
            <div className={`flex items-center px-2 py-1 rounded-full text-[10px] font-mono tracking-wide border border-slate-700/50 bg-[#1a1a1e] ${getRelevanceColor(item.relevance_score)} cursor-help`}>
              <Zap size={10} className="mr-1" />
              {(item.relevance_score * 100).toFixed(0)}% REL
            </div>
            <div className="absolute bottom-full right-0 mb-2 w-56 p-2.5 bg-[#1a1a1e] border border-slate-700 text-slate-300 text-[11px] leading-relaxed rounded-lg shadow-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-50 pointer-events-none">
              This score represents the AI's calculated relevance of the article to your portfolio or global market trends.
            </div>
          </div>
          <div className={`flex items-center px-2 py-1 rounded-full text-[11px] font-mono tracking-wide border ${config.bg} ${config.color} ${config.border} shadow-sm`}>
            {config.icon}
            {item.sentiment}
          </div>
        </div>
      </div>
      
      <h3 className="text-slate-100 font-semibold text-lg leading-tight mb-3 group-hover:text-blue-400 transition-colors">
        {item.headline}
      </h3>

      {item.image && (
        <div className="mb-4 rounded-lg overflow-hidden border border-slate-800/50 shadow-inner">
          <img 
            src={item.image} 
            alt="News thumbnail" 
            className="w-full h-48 object-cover hover:scale-105 transition-transform duration-700"
            referrerPolicy="no-referrer"
            loading="lazy"
          />
        </div>
      )}
      
      <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3 mb-4 flex items-start space-x-3">
        <Sparkles size={14} className="text-purple-400 mt-0.5 flex-shrink-0" />
        <p className="text-purple-200/90 text-[13px] leading-relaxed">
          {item.context_summary}
        </p>
      </div>
      
      {/* AI Summary Section */}
      <div className="mb-3 relative z-10">
        {!summary && !isSummarizing ? (
          <button 
            onClick={handleSummarize}
            className="flex items-center space-x-1.5 text-[10px] font-mono uppercase tracking-widest text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-2 rounded-md transition-colors border border-blue-500/20 w-fit"
          >
            <FileText size={12} />
            <span>Generate AI Summary</span>
          </button>
        ) : isSummarizing ? (
          <div className="flex items-center space-x-2 text-[10px] font-mono uppercase tracking-widest text-blue-400 bg-blue-500/5 px-3 py-2 rounded-md border border-blue-500/10 w-fit">
            <Loader2 size={12} className="animate-spin" />
            <span>Summarizing...</span>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-[#0a0a0c] border border-blue-500/20 border-l-2 border-l-blue-500 rounded-md p-4 shadow-inner"
          >
            <div className="flex items-center justify-between mb-3 border-b border-blue-500/10 pb-2">
              <div className="flex items-center space-x-2">
                <FileText size={14} className="text-blue-400" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-blue-400 font-semibold">AI Summary</span>
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-[9px] font-mono text-slate-500 bg-slate-800/50 px-1.5 py-0.5 rounded">{summary?.length || 0} CHARS</span>
                <button 
                  onClick={handleRegenerateSummary}
                  className="flex items-center space-x-1 text-[9px] font-mono uppercase tracking-widest text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 px-1.5 py-0.5 rounded transition-colors"
                  title="Regenerate Summary"
                >
                  <RefreshCw size={10} />
                  <span>Regenerate</span>
                </button>
              </div>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed font-sans">
              {summary}
            </p>
            <div className="flex justify-end items-center space-x-2 mt-4 pt-3 border-t border-blue-500/10">
              {summaryFeedback ? (
                <span className="text-[10px] text-emerald-400/90 font-mono flex items-center bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                  <Check size={10} className="mr-1" /> Feedback recorded
                </span>
              ) : (
                <div className="flex items-center bg-slate-800/30 rounded-md p-0.5 border border-slate-700/50">
                  <span className="text-[9px] text-slate-500 font-mono uppercase tracking-widest px-2">Helpful?</span>
                  <div className="h-3 w-px bg-slate-700/50 mx-1"></div>
                  <button 
                    onClick={(e) => handleSummaryFeedback(e, 'up')} 
                    className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors"
                  >
                    <ThumbsUp size={12} />
                  </button>
                  <button 
                    onClick={(e) => handleSummaryFeedback(e, 'down')} 
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                  >
                    <ThumbsDown size={12} />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
      
      <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono uppercase tracking-widest border-t border-white/5 pt-4 mt-2 relative z-10">
        <div className="flex items-center space-x-4">
          <span className="flex items-center">
            {item.source.toLowerCase().includes('reddit') ? (
              <MessageSquare size={12} className="mr-1.5 text-orange-500" />
            ) : (
              <span className="mr-1.5">SRC:</span>
            )}
            <span className={item.source.toLowerCase().includes('reddit') ? 'text-orange-400/80' : ''}>
              {item.source}
            </span>
          </span>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleLike}
              disabled={isLiking}
              className={`flex items-center space-x-1 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100 ${
                isLiked ? 'text-rose-400 opacity-100' : ''
              }`}
            >
              {isLiking ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Heart size={12} className={isLiked ? 'fill-current' : ''} />
              )}
              {likesCount > 0 && <span className="ml-1">{likesCount}</span>}
            </button>

            <div className="relative" ref={shareRef}>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsShareOpen(!isShareOpen);
                }}
                className="flex items-center hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Share2 size={12} />
              </button>
              
              <AnimatePresence>
                {isShareOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 5, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 5, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-full right-0 mb-2 w-40 bg-[#1a1a1e] border border-slate-700 rounded-lg shadow-xl overflow-hidden z-50"
                  >
                    <div className="flex flex-col py-1">
                      <button 
                        onClick={(e) => handleShare(e, 'copy')}
                        className="flex items-center px-3 py-2 hover:bg-white/5 text-slate-300 transition-colors"
                      >
                        {copied ? <Check size={12} className="mr-2 text-emerald-400" /> : <Copy size={12} className="mr-2" />}
                        {copied ? 'COPIED!' : 'COPY LINK'}
                      </button>
                      <button 
                        onClick={(e) => handleShare(e, 'Twitter')}
                        className="flex items-center px-3 py-2 hover:bg-white/5 text-slate-300 transition-colors"
                      >
                        <Twitter size={12} className="mr-2 text-blue-400" />
                        X / TWITTER
                      </button>
                      <button 
                        onClick={(e) => handleShare(e, 'LinkedIn')}
                        className="flex items-center px-3 py-2 hover:bg-white/5 text-slate-300 transition-colors"
                      >
                        <Linkedin size={12} className="mr-2 text-blue-500" />
                        LINKEDIN
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
        
        {item.url && (
          <button 
            className="flex items-center space-x-1.5 text-blue-400 hover:text-blue-300 transition-colors opacity-0 group-hover:opacity-100 bg-blue-500/10 hover:bg-blue-500/20 px-2 py-1.5 rounded border border-blue-500/20"
            onClick={handleCardClick}
          >
            <span>READ FULL</span>
            <ExternalLink size={12} />
          </button>
        )}
      </div>

      {/* Sentiment Bar */}
      <div className="mt-4 relative z-10">
        <div className="flex justify-between text-[9px] font-mono text-slate-500 mb-1.5 tracking-widest opacity-70">
          <span>BEARISH</span>
          <span>NEUTRAL</span>
          <span>BULLISH</span>
        </div>
        <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
          <div className={`h-full rounded-full transition-all duration-1000 ${
            item.sentiment === 'Bullish' ? 'w-[85%] bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]' :
            item.sentiment === 'Bearish' ? 'w-[15%] bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)]' :
            'w-[50%] bg-slate-400 shadow-[0_0_10px_rgba(148,163,184,0.5)]'
          }`}></div>
        </div>
      </div>

      {/* Related Articles Toggle */}
      <div className="mt-4 pt-3 border-t border-white/5 relative z-10">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="flex items-center justify-center w-full text-xs font-mono text-slate-400 hover:text-slate-200 transition-colors py-1"
        >
          {isExpanded ? (
            <>HIDE RELATED <ChevronUp size={14} className="ml-1" /></>
          ) : (
            <>SHOW RELATED <ChevronDown size={14} className="ml-1" /></>
          )}
        </button>
      </div>

      {/* Related Articles Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden relative z-10"
          >
            <div className="pt-3 space-y-2 max-h-64 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
              {isLoadingRelated ? (
                <div className="flex justify-center py-4">
                  <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                </div>
              ) : relatedArticles.length > 0 ? (
                relatedArticles.map((article) => (
                  <div 
                    key={article.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (article.url) {
                        if (onArticleClick) onArticleClick(article.url);
                        else window.open(article.url, '_blank', 'noopener,noreferrer');
                      }
                    }}
                    className="bg-black/20 rounded-md p-2.5 border border-white/5 hover:bg-white/5 transition-colors cursor-pointer group/related"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <h4 className="text-xs text-slate-300 group-hover/related:text-white transition-colors line-clamp-2 leading-snug">
                        {article.headline}
                      </h4>
                      {article.image && (
                        <img 
                          src={article.image} 
                          alt="" 
                          className="w-10 h-10 object-cover rounded flex-shrink-0 border border-white/10"
                          referrerPolicy="no-referrer"
                          loading="lazy"
                        />
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-1.5 text-[9px] font-mono text-slate-500">
                      <span>{timeAgo(article.timestamp)}</span>
                      <span className="flex items-center">
                        <LinkIcon size={8} className="mr-1" />
                        {article.source}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-xs font-mono text-slate-500">
                  No related articles found.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
