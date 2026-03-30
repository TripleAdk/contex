import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, Mail } from 'lucide-react';

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: 'alert' | 'email';
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col space-y-3 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className={`pointer-events-auto flex items-start p-4 rounded-xl shadow-2xl border backdrop-blur-md w-80 ${
              toast.type === 'alert' 
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-100' 
                : 'bg-blue-500/10 border-blue-500/30 text-blue-100'
            }`}
          >
            <div className={`p-2 rounded-full mr-3 flex-shrink-0 ${
              toast.type === 'alert' ? 'bg-rose-500/20 text-rose-400' : 'bg-blue-500/20 text-blue-400'
            }`}>
              {toast.type === 'alert' ? <Bell size={18} /> : <Mail size={18} />}
            </div>
            <div className="flex-1 mr-2">
              <h4 className={`text-sm font-bold mb-1 ${toast.type === 'alert' ? 'text-rose-400' : 'text-blue-400'}`}>
                {toast.title}
              </h4>
              <p className="text-xs opacity-90 leading-relaxed">{toast.message}</p>
            </div>
            <button 
              onClick={() => removeToast(toast.id)}
              className="text-white/50 hover:text-white transition-colors p-1"
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
