import React, { useState, useEffect } from 'react';
import { Send, Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { generateTrendingTopics } from '../services/geminiService';
import { EnrichedNewsItem, Post } from '../types';

interface CreatePostProps {
  news: EnrichedNewsItem[];
  onPostCreated?: (post: Post) => void;
}

export const CreatePost: React.FC<CreatePostProps> = ({ news, onPostCreated }) => {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [trendingTopics, setTrendingTopics] = useState<string[]>([]);
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);

  useEffect(() => {
    const fetchTopics = async () => {
      if (news.length === 0) return;
      setIsLoadingTopics(true);
      try {
        const topics = await generateTrendingTopics(news);
        setTrendingTopics(topics);
      } catch (error) {
        console.error("Failed to load trending topics", error);
      } finally {
        setIsLoadingTopics(false);
      }
    };

    fetchTopics();
  }, [news]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsSubmitting(true);
    try {
      let newPost: Post = {
        id: Math.random().toString(36).substring(7),
        user_id: user?.id || 'local-user',
        content: content.trim(),
        created_at: new Date().toISOString(),
        author_email: user?.email || 'local@user.com',
      };

      if (supabase && user) {
        const { data, error } = await supabase
          .from('posts')
          .insert([
            {
              user_id: user.id,
              content: content.trim(),
              author_email: user.email,
            }
          ])
          .select()
          .single();

        if (error) throw error;
        if (data) newPost = data as Post;
      }
      
      setContent('');
      if (onPostCreated) onPostCreated(newPost);
    } catch (error) {
      console.error('Error creating post:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTopicClick = (topic: string) => {
    setContent(prev => {
      const newContent = prev.trim() ? `${prev} ${topic}` : topic;
      return newContent + ' ';
    });
  };

  return (
    <div className="bg-[#0a0a0c] border border-slate-800/80 rounded-xl p-4 mb-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500/20 via-indigo-500/20 to-purple-500/20"></div>
      
      <form onSubmit={handleSubmit}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Share your market insights..."
          className="w-full bg-[#121214] border border-slate-800 rounded-lg px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 focus:bg-[#16161a] transition-all resize-none min-h-[80px]"
        />
        
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={12} className="text-indigo-400" />
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
                AI Suggested Topics
              </span>
              {isLoadingTopics && <Loader2 size={10} className="animate-spin text-slate-500" />}
            </div>
            <div className="flex flex-wrap gap-2">
              {trendingTopics.length > 0 ? (
                trendingTopics.map((topic, idx) => {
                  const isTopTopic = idx < 2;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleTopicClick(topic)}
                      className={`text-[10px] font-mono px-2 py-1 rounded-md transition-colors ${
                        isTopTopic
                          ? "bg-indigo-500/20 text-indigo-200 border border-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.4)] hover:bg-indigo-500/30 hover:border-indigo-300"
                          : "bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 hover:bg-indigo-500/20 hover:border-indigo-500/40"
                      }`}
                    >
                      {topic}
                    </button>
                  );
                })
              ) : !isLoadingTopics ? (
                <span className="text-[10px] text-slate-600 font-mono italic">No suggestions available</span>
              ) : null}
            </div>
          </div>
          
          <button
            type="submit"
            disabled={!content.trim() || isSubmitting}
            className="self-end sm:self-auto bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-xs font-mono uppercase tracking-wider transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <Loader2 className="animate-spin" size={14} />
            ) : (
              <Send size={14} />
            )}
            <span>Post</span>
          </button>
        </div>
      </form>
    </div>
  );
};
