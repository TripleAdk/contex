import React, { useState } from 'react';
import { User, Clock, Heart, UserPlus, UserCheck, Loader2 } from 'lucide-react';
import { Post } from '../types';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface PostCardProps {
  post: Post;
  onLikeUpdate?: (postId: string, isLiked: boolean, likesCount: number) => void;
  onFollowUpdate?: (userId: string, isFollowing: boolean) => void;
  isFollowing?: boolean;
}

export const PostCard: React.FC<PostCardProps> = React.memo(({ post, onLikeUpdate, onFollowUpdate, isFollowing }) => {
  const { user } = useAuth();
  const [isLiking, setIsLiking] = useState(false);
  const [isFollowingLoading, setIsFollowingLoading] = useState(false);
  const [isReacting, setIsReacting] = useState(false);

  // Local state for reactions to handle optimistic updates and missing DB columns
  const [localReactions, setLocalReactions] = useState(post.reactions || { bullish: 0, bearish: 0, neutral: 0 });
  const [localUserReaction, setLocalUserReaction] = useState(post.user_reaction || null);

  const timeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    let interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + 'h ago';
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + 'm ago';
    return Math.floor(seconds) + 's ago';
  };

  const handleLike = async () => {
    if (!supabase || !user || isLiking) return;

    setIsLiking(true);
    try {
      if (post.is_liked) {
        // Unlike
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', user.id);

        if (error) throw error;
        if (onLikeUpdate) onLikeUpdate(post.id, false, (post.likes_count || 1) - 1);
      } else {
        // Like
        const { error } = await supabase
          .from('likes')
          .insert([{ post_id: post.id, user_id: user.id }]);

        if (error) throw error;
        if (onLikeUpdate) onLikeUpdate(post.id, true, (post.likes_count || 0) + 1);
      }
    } catch (err) {
      console.error('Error toggling like:', err);
    } finally {
      setIsLiking(false);
    }
  };

  const handleFollow = async () => {
    if (!supabase || !user || isFollowingLoading || user.id === post.user_id) return;

    setIsFollowingLoading(true);
    try {
      if (isFollowing) {
        // Unfollow
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', post.user_id);

        if (error) throw error;
        if (onFollowUpdate) onFollowUpdate(post.user_id, false);
      } else {
        // Follow
        const { error } = await supabase
          .from('follows')
          .insert([{ follower_id: user.id, following_id: post.user_id }]);

        if (error) throw error;
        if (onFollowUpdate) onFollowUpdate(post.user_id, true);
      }
    } catch (err) {
      console.error('Error toggling follow:', err);
    } finally {
      setIsFollowingLoading(false);
    }
  };

  const handleReaction = async (reactionType: 'bullish' | 'bearish' | 'neutral') => {
    if (!user || isReacting) return;

    setIsReacting(true);
    
    // Optimistic update
    const previousReaction = localUserReaction;
    const previousReactions = { ...localReactions };
    
    let newReactions = { ...localReactions };
    let newUserReaction: 'bullish' | 'bearish' | 'neutral' | null = reactionType;
    
    if (previousReaction === reactionType) {
      // Toggle off
      newReactions[reactionType] = Math.max(0, newReactions[reactionType] - 1);
      newUserReaction = null;
    } else {
      // Change reaction or add new
      if (previousReaction) {
        newReactions[previousReaction] = Math.max(0, newReactions[previousReaction] - 1);
      }
      newReactions[reactionType] += 1;
    }
    
    setLocalReactions(newReactions);
    setLocalUserReaction(newUserReaction);

    try {
      if (supabase) {
        // Try to update a reactions column if it exists (JSONB)
        // This might fail if the column doesn't exist, but we keep the local state updated
        await supabase
          .from('posts')
          .update({ reactions: newReactions })
          .eq('id', post.id);
          
        // We would ideally have a post_reactions table to track who reacted with what,
        // but for this prototype, we'll just rely on the local state for the current session
        // if the DB schema doesn't support it yet.
      }
    } catch (err) {
      console.warn('Could not persist reaction to DB, using local state only:', err);
    } finally {
      setIsReacting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] border-l-4 border-l-blue-500 rounded-xl p-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] hover:bg-white/[0.06] transition-all group relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-500/20 p-1.5 rounded-full border border-blue-500/30">
            <User size={14} className="text-blue-400" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono text-slate-300 font-semibold">
                {post.author_email ? post.author_email.split('@')[0] : 'Anonymous'}
              </span>
              {user && user.id !== post.user_id && (
                <button
                  onClick={handleFollow}
                  disabled={isFollowingLoading}
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-all flex items-center space-x-1 ${
                    isFollowing 
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                      : 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20'
                  }`}
                >
                  {isFollowingLoading ? (
                    <Loader2 size={10} className="animate-spin" />
                  ) : isFollowing ? (
                    <>
                      <UserCheck size={10} />
                      <span>Following</span>
                    </>
                  ) : (
                    <>
                      <UserPlus size={10} />
                      <span>Follow</span>
                    </>
                  )}
                </button>
              )}
            </div>
            <span className="text-[11px] text-slate-500 font-mono tracking-wider uppercase">
              {timeAgo(post.created_at)}
            </span>
          </div>
        </div>
      </div>
      
      <p className="text-[15px] text-slate-200 leading-relaxed whitespace-pre-wrap group-hover:text-white transition-colors mb-4">
        {post.content}
      </p>

      {/* Visual Representation of Reactions */}
      {(localReactions.bullish > 0 || localReactions.bearish > 0 || localReactions.neutral > 0) && (
        <div className="mb-4">
          <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-white/5 mb-2">
            <div 
              className="bg-emerald-500 transition-all duration-500" 
              style={{ width: `${(localReactions.bullish / (localReactions.bullish + localReactions.bearish + localReactions.neutral)) * 100}%` }}
            />
            <div 
              className="bg-blue-500 transition-all duration-500" 
              style={{ width: `${(localReactions.neutral / (localReactions.bullish + localReactions.bearish + localReactions.neutral)) * 100}%` }}
            />
            <div 
              className="bg-rose-500 transition-all duration-500" 
              style={{ width: `${(localReactions.bearish / (localReactions.bullish + localReactions.bearish + localReactions.neutral)) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono uppercase tracking-wider">
            <span className="text-emerald-400/70">{localReactions.bullish} Bullish</span>
            <span className="text-blue-400/70">{localReactions.neutral} Neutral</span>
            <span className="text-rose-400/70">{localReactions.bearish} Bearish</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-white/5">
        <div className="flex items-center space-x-4">
          <button
            onClick={handleLike}
            disabled={isLiking}
            className={`flex items-center space-x-1.5 text-xs font-mono transition-colors ${
              post.is_liked ? 'text-rose-400' : 'text-slate-500 hover:text-rose-400'
            }`}
          >
            {isLiking ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Heart size={14} className={post.is_liked ? 'fill-current' : ''} />
            )}
            <span>{post.likes_count || 0}</span>
          </button>
        </div>

        {/* Reactions */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleReaction('bullish')}
            disabled={isReacting}
            className={`flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-mono transition-all ${
              localUserReaction === 'bullish' 
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-transparent'
            }`}
            title="Bullish"
          >
            <span>🚀</span>
          </button>
          
          <button
            onClick={() => handleReaction('bearish')}
            disabled={isReacting}
            className={`flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-mono transition-all ${
              localUserReaction === 'bearish' 
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-transparent'
            }`}
            title="Bearish"
          >
            <span>📉</span>
          </button>
          
          <button
            onClick={() => handleReaction('neutral')}
            disabled={isReacting}
            className={`flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-mono transition-all ${
              localUserReaction === 'neutral' 
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-transparent'
            }`}
            title="Neutral"
          >
            <span>😐</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
});
