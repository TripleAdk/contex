import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Bell, Plus, Trash2, Mail, AlertTriangle } from 'lucide-react';
import { PriceAlert } from '../types';

interface AlertsManagerProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: PriceAlert[];
  onAddAlert: (alert: Omit<PriceAlert, 'id' | 'isTriggered'>) => void;
  onRemoveAlert: (id: string) => void;
  tickers: string[];
}

export const AlertsManager: React.FC<AlertsManagerProps> = React.memo(({
  isOpen,
  onClose,
  alerts,
  onAddAlert,
  onRemoveAlert,
  tickers,
}) => {
  const [selectedTicker, setSelectedTicker] = useState(tickers[0] || '');
  const [condition, setCondition] = useState<'above' | 'below'>('above');
  const [threshold, setThreshold] = useState('');
  const [emailEnabled, setEmailEnabled] = useState(false);

  React.useEffect(() => {
    if (!selectedTicker && tickers.length > 0) {
      setSelectedTicker(tickers[0]);
    }
  }, [tickers, selectedTicker]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicker || !threshold || isNaN(Number(threshold))) return;

    onAddAlert({
      ticker: selectedTicker,
      condition,
      threshold: Number(threshold),
      emailEnabled,
    });

    setThreshold('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="bg-[#0a0a0c] border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#121214]">
              <div className="flex items-center space-x-2">
                <Bell className="text-blue-400" size={20} />
                <h2 className="text-lg font-bold text-slate-200 tracking-tight">Price Alerts</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-slate-400 uppercase tracking-wider">Ticker</label>
                    <select
                      value={selectedTicker}
                      onChange={(e) => setSelectedTicker(e.target.value)}
                      className="w-full bg-[#121214] border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
                    >
                      {tickers.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-slate-400 uppercase tracking-wider">Condition</label>
                    <select
                      value={condition}
                      onChange={(e) => setCondition(e.target.value as 'above' | 'below')}
                      className="w-full bg-[#121214] border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
                    >
                      <option value="above">Crosses Above</option>
                      <option value="below">Crosses Below</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-400 uppercase tracking-wider">Price Threshold ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                    placeholder="e.g. 150.50"
                    className="w-full bg-[#121214] border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
                    required
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Mail className="text-blue-400" size={16} />
                    <span className="text-sm text-slate-300">Email Notification</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={emailEnabled}
                      onChange={(e) => setEmailEnabled(e.target.checked)}
                    />
                    <div className="w-9 h-5 bg-[var(--border-secondary)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={!threshold}
                  className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                  <Plus size={16} />
                  <span>Add Alert</span>
                </button>
              </form>

              <div className="border-t border-slate-800 pt-6">
                <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center">
                  <AlertTriangle size={14} className="text-amber-400 mr-2" />
                  Active Alerts
                </h3>
                
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {alerts.length === 0 ? (
                    <p className="text-xs text-slate-500 font-mono text-center py-4 border border-dashed border-slate-800 rounded-lg">
                      No active alerts
                    </p>
                  ) : (
                    alerts.map(alert => (
                      <div 
                        key={alert.id} 
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          alert.isTriggered 
                            ? 'bg-rose-500/10 border-rose-500/30' 
                            : 'bg-[#121214] border-slate-800'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`font-mono text-xs font-bold px-2 py-1 rounded ${
                            alert.isTriggered ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-800 text-slate-300'
                          }`}>
                            {alert.ticker}
                          </div>
                          <div className="text-sm text-slate-300">
                            {alert.condition === 'above' ? '≥' : '≤'} <span className="font-mono">${alert.threshold.toFixed(2)}</span>
                          </div>
                          {alert.emailEnabled && <Mail size={12} className="text-blue-400" />}
                        </div>
                        <button
                          onClick={() => onRemoveAlert(alert.id)}
                          className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
