import React, { useState, useEffect } from 'react';
import { X, User, Shield, Target, Loader2, Check, Edit2, Palette, Plus, Trash2, Activity } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';

import { TickerManager } from './TickerManager';

interface ProfileSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdate?: (profile: { riskTolerance: string; preferredSectors: string[] }) => void;
}

type Theme = 'dark' | 'light' | 'high-contrast';

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({ isOpen, onClose, onProfileUpdate }) => {
  const { user } = useAuth();
  const [fullName, setFullName] = useState('');
  const [riskTolerance, setRiskTolerance] = useState('Medium');
  const [preferredSectors, setPreferredSectors] = useState<string[]>([]);
  const [theme, setTheme] = useState<Theme>('dark');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [watchlist, setWatchlist] = useState<{ id: string; ticker: string }[]>([]);
  const [toastMessage, setToastMessage] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  const showToast = (message: string, type: 'error' | 'success') => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const availableSectors = ['Technology', 'Finance', 'Healthcare', 'Energy', 'Consumer', 'Real Estate'];
  const availableThemes: { id: Theme; label: string }[] = [
    { id: 'dark', label: 'Dark (Default)' },
    { id: 'light', label: 'Light' },
    { id: 'high-contrast', label: 'High Contrast' }
  ];

  useEffect(() => {
    // Load theme from localStorage on mount
    const savedTheme = localStorage.getItem('app-theme') as Theme;
    if (savedTheme && availableThemes.some(t => t.id === savedTheme)) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  }, []);

  useEffect(() => {
    if (isOpen && user && supabase) {
      fetchProfile();
    }
  }, [isOpen, user]);

  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase!
        .from('profiles')
        .select('full_name, risk_tolerance, preferred_sectors')
        .eq('id', user?.id)
        .single();

      if (error) throw error;
      
      if (data) {
        setFullName(data.full_name || '');
        setRiskTolerance(data.risk_tolerance || 'Medium');
        setPreferredSectors(data.preferred_sectors || []);
      }

      const { data: watchlistData, error: watchlistError } = await supabase!
        .from('watchlists')
        .select('id, ticker')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (watchlistError) throw watchlistError;

      if (watchlistData) {
        setWatchlist(watchlistData);
      }
    } catch (err) {
      console.error('Error fetching profile data:', err);
      showToast('Failed to load profile data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    fetchProfile(); // Reset to saved values
  };

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem('app-theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !supabase) return;

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          risk_tolerance: riskTolerance,
          preferred_sectors: preferredSectors,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;
      
      if (onProfileUpdate) {
        onProfileUpdate({
          riskTolerance,
          preferredSectors
        });
      }

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setIsEditing(false);
      }, 2500);
    } catch (err) {
      console.error('Error saving profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSector = (sector: string) => {
    setPreferredSectors(prev => 
      prev.includes(sector) 
        ? prev.filter(s => s !== sector)
        : [...prev, sector]
    );
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-md bg-[#0a0a0c] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between p-5 border-b border-slate-800/80 bg-[#121214]">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-500/10 p-1.5 rounded-md border border-blue-500/20">
                <User className="text-blue-400" size={18} />
              </div>
              <h2 className="text-slate-200 font-mono font-semibold tracking-widest uppercase text-sm">
                Profile Settings
              </h2>
            </div>
            <button 
              onClick={onClose}
              className="text-slate-500 hover:text-slate-300 transition-colors bg-[#1a1a1e] p-1.5 rounded-md border border-slate-700/50"
            >
              <X size={16} />
            </button>
          </div>

          {isLoading ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="animate-spin text-blue-500" size={32} />
            </div>
          ) : (
            <form onSubmit={handleSave} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
              {/* Full Name */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono text-slate-400 uppercase tracking-wider ml-1 flex items-center space-x-2">
                    <User size={12} />
                    <span>Display Name</span>
                  </label>
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="text-xs font-mono text-blue-400 hover:text-blue-300 flex items-center space-x-1 transition-colors"
                    >
                      <Edit2 size={12} />
                      <span>Edit</span>
                    </button>
                  )}
                </div>
                {isEditing ? (
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-[#121214] border border-slate-800 rounded-lg px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 focus:bg-[#16161a] transition-all"
                    placeholder="Enter your name"
                  />
                ) : (
                  <div className="w-full bg-[#121214]/50 border border-slate-800/50 rounded-lg px-4 py-3 text-sm text-slate-300">
                    {fullName || 'Not set'}
                  </div>
                )}
              </div>

              {/* Risk Tolerance */}
              <div className="space-y-2">
                <label className="text-xs font-mono text-slate-400 uppercase tracking-wider ml-1 flex items-center space-x-2">
                  <Shield size={12} />
                  <span>Risk Tolerance</span>
                </label>
                {isEditing ? (
                  <div className="grid grid-cols-3 gap-2">
                    {['Low', 'Medium', 'High'].map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setRiskTolerance(level)}
                        className={`py-2 px-3 rounded-lg text-xs font-mono uppercase tracking-wider border transition-all ${
                          riskTolerance === level 
                            ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' 
                            : 'bg-[#121214] border-slate-800 text-slate-500 hover:border-slate-700'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="w-full bg-[#121214]/50 border border-slate-800/50 rounded-lg px-4 py-3 text-sm text-slate-300 font-mono uppercase tracking-wider">
                    {riskTolerance}
                  </div>
                )}
              </div>

              {/* Preferred Sectors */}
              <div className="space-y-2">
                <label className="text-xs font-mono text-slate-400 uppercase tracking-wider ml-1 flex items-center space-x-2">
                  <Target size={12} />
                  <span>Preferred Sectors</span>
                </label>
                {isEditing ? (
                  <div className="flex flex-wrap gap-2">
                    {availableSectors.map((sector) => (
                      <button
                        key={sector}
                        type="button"
                        onClick={() => toggleSector(sector)}
                        className={`py-1.5 px-3 rounded-full text-[10px] font-mono uppercase tracking-wider border transition-all ${
                          preferredSectors.includes(sector)
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                            : 'bg-[#121214] border-slate-800 text-slate-500 hover:border-slate-700'
                        }`}
                      >
                        {sector}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {preferredSectors.length > 0 ? (
                      preferredSectors.map((sector) => (
                        <span
                          key={sector}
                          className="py-1.5 px-3 rounded-full text-[10px] font-mono uppercase tracking-wider border bg-emerald-500/10 border-emerald-500/30 text-emerald-400/80"
                        >
                          {sector}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-slate-500 italic">None selected</span>
                    )}
                  </div>
                )}
              </div>

              {/* Watchlist Manager */}
              <div className="pt-4 border-t border-slate-800/50">
                <TickerManager 
                  initialWatchlist={watchlist} 
                  onWatchlistChange={(newWatchlist) => setWatchlist(newWatchlist)} 
                />
              </div>

              {/* Theme Selection */}
              <div className="space-y-2 pt-4 border-t border-slate-800/50">
                <label className="text-xs font-mono text-slate-400 uppercase tracking-wider ml-1 flex items-center space-x-2">
                  <Palette size={12} />
                  <span>App Theme</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {availableThemes.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleThemeChange(t.id)}
                      className={`py-2 px-3 rounded-lg text-xs font-mono uppercase tracking-wider border transition-all ${
                        theme === t.id 
                          ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' 
                          : 'bg-[#121214] border-slate-800 text-slate-500 hover:border-slate-700'
                      }`}
                    >
                      {t.label.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              {isEditing && (
                <div className="pt-4 border-t border-slate-800/80 flex justify-between items-center">
                  <div className="flex-1">
                    {saveSuccess && (
                      <motion.span 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="text-emerald-400 text-xs font-mono flex items-center gap-1.5"
                      >
                        <Check size={14} />
                        Profile saved successfully!
                      </motion.span>
                    )}
                  </div>
                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-wider text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-6 py-2 text-xs font-mono uppercase tracking-wider transition-colors flex items-center space-x-2 disabled:opacity-50"
                    >
                      {isSaving && <Loader2 className="animate-spin" size={14} />}
                      <span>{isSaving ? 'Saving...' : saveSuccess ? 'Saved' : 'Save Profile'}</span>
                    </button>
                  </div>
                </div>
              )}
            </form>
          )}
          
          {/* Toast Notification */}
          <AnimatePresence>
            {toastMessage && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className={`absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-xs font-mono shadow-lg border flex items-center space-x-2 ${
                  toastMessage.type === 'success' 
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                    : 'bg-red-500/10 border-red-500/30 text-red-400'
                }`}
              >
                {toastMessage.type === 'success' ? <Check size={14} /> : <X size={14} />}
                <span>{toastMessage.message}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
