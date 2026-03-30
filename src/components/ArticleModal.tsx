import React, { useState, useEffect } from 'react';
import { X, ExternalLink, AlertCircle, Loader2, FileText, Copy, Check, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { fetchArticleContent } from '../services/geminiService';

interface ArticleModalProps {
  url: string | null;
  onClose: () => void;
}

export const ArticleModal: React.FC<ArticleModalProps> = ({ url, onClose }) => {
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (url) {
      setIsLoading(true);
      setContent(null);
      setCopied(false);
      fetchArticleContent(url).then((res) => {
        setContent(res);
        setIsLoading(false);
      });
    }
  }, [url]);

  const handleCopy = () => {
    if (content) {
      navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!url) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="bg-[#0a0a0c] border border-slate-800 rounded-2xl w-full max-w-4xl h-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-[#121214]">
            <div className="flex items-center space-x-4 overflow-hidden">
              <span className="text-xs font-mono text-slate-400 truncate max-w-[200px] sm:max-w-md">
                {url}
              </span>
              <div className="hidden md:flex items-center text-[10px] text-emerald-400/80 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                <Sparkles size={12} className="mr-1.5" />
                AI Extracted Article
              </div>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-slate-300 transition-colors flex items-center text-xs font-mono bg-slate-800/50 px-2 py-1 rounded border border-slate-700/50"
                title="Open original article in new tab"
              >
                <ExternalLink size={12} className="mr-1.5" />
                Original
              </a>
            </div>
            <div className="flex items-center space-x-2 ml-2 flex-shrink-0">
              {!isLoading && content && (
                <button
                  onClick={handleCopy}
                  className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors flex items-center"
                  title="Copy content"
                >
                  {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                </button>
              )}
              <div className="w-px h-6 bg-slate-800 mx-1"></div>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>
          <div className="flex-1 bg-[#0a0a0c] relative overflow-y-auto custom-scrollbar p-6 md:p-10 lg:px-16">
            {isLoading ? (
              <div className="max-w-3xl mx-auto space-y-6 animate-pulse mt-4">
                <div className="flex items-center space-x-3 mb-8">
                  <div className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                  <span className="font-mono text-xs uppercase tracking-widest text-emerald-500/80">Extracting Article Content...</span>
                </div>
                <div className="h-8 w-3/4 bg-slate-800/50 rounded-md"></div>
                <div className="h-8 w-1/2 bg-slate-800/50 rounded-md mb-8"></div>
                
                <div className="space-y-3">
                  <div className="h-4 w-full bg-slate-800/30 rounded"></div>
                  <div className="h-4 w-full bg-slate-800/30 rounded"></div>
                  <div className="h-4 w-5/6 bg-slate-800/30 rounded"></div>
                </div>
                
                <div className="space-y-3 pt-4">
                  <div className="h-4 w-full bg-slate-800/30 rounded"></div>
                  <div className="h-4 w-11/12 bg-slate-800/30 rounded"></div>
                  <div className="h-4 w-full bg-slate-800/30 rounded"></div>
                  <div className="h-4 w-4/5 bg-slate-800/30 rounded"></div>
                </div>
                
                <div className="space-y-3 pt-4">
                  <div className="h-4 w-full bg-slate-800/30 rounded"></div>
                  <div className="h-4 w-full bg-slate-800/30 rounded"></div>
                  <div className="h-4 w-3/4 bg-slate-800/30 rounded"></div>
                </div>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto">
                <div className="prose prose-invert prose-slate max-w-none prose-headings:font-sans prose-headings:tracking-tight prose-headings:text-slate-100 prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline prose-p:leading-relaxed prose-p:text-slate-300 prose-li:text-slate-300 prose-strong:text-slate-200 prose-blockquote:border-l-blue-500 prose-blockquote:bg-blue-500/5 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-blockquote:not-italic prose-blockquote:text-slate-300">
                  <Markdown>{content || ''}</Markdown>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
