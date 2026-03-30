import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Activity, 
  PlusCircle, 
  BarChart3, 
  MessageSquare,
  Sparkles
} from 'lucide-react';

interface OnboardingTutorialProps {
  isOpen: boolean;
  onClose: () => void;
}

const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to Smart Feed',
    description: 'Your AI-powered financial command center. Stay ahead of the market with real-time news, sentiment analysis, and community insights.',
    icon: <Sparkles className="w-12 h-12 text-blue-400" />,
    color: 'from-blue-500/20 to-purple-500/20',
    borderColor: 'border-blue-500/30'
  },
  {
    id: 'portfolio',
    title: 'Track Your Portfolio',
    description: 'Add your favorite stock tickers in the sidebar. We\'ll curate a personalized news feed and AI market mood specifically for your assets.',
    icon: <PlusCircle className="w-12 h-12 text-emerald-400" />,
    color: 'from-emerald-500/20 to-teal-500/20',
    borderColor: 'border-emerald-500/30'
  },
  {
    id: 'sentiment',
    title: 'Understand Sentiment',
    description: 'Our AI instantly analyzes every news event, scoring its relevance and determining if it\'s Bullish, Bearish, or just Noise.',
    icon: <BarChart3 className="w-12 h-12 text-amber-400" />,
    color: 'from-amber-500/20 to-orange-500/20',
    borderColor: 'border-amber-500/30'
  },
  {
    id: 'community',
    title: 'Share Insights',
    description: 'Post your own market analysis, share trading ideas, and discuss breaking news with the rest of the community.',
    icon: <MessageSquare className="w-12 h-12 text-rose-400" />,
    color: 'from-rose-500/20 to-pink-500/20',
    borderColor: 'border-rose-500/30'
  }
];

export const OnboardingTutorial: React.FC<OnboardingTutorialProps> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const step = TUTORIAL_STEPS[currentStep];
  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onClose();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    setCurrentStep(prev => Math.max(0, prev - 1));
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          key={currentStep}
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: -20 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="bg-[#0a0a0c] border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors z-10"
          >
            <X size={20} />
          </button>

          {/* Header Graphic */}
          <div className={`h-40 w-full bg-gradient-to-br ${step.color} border-b ${step.borderColor} flex items-center justify-center relative overflow-hidden`}>
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="bg-[#0a0a0c]/80 p-4 rounded-full backdrop-blur-md border border-white/10 shadow-lg"
            >
              {step.icon}
            </motion.div>
          </div>

          {/* Content */}
          <div className="p-8 text-center">
            <motion.h2 
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-2xl font-bold text-slate-200 mb-4 tracking-tight"
            >
              {step.title}
            </motion.h2>
            <motion.p 
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-slate-400 leading-relaxed text-sm"
            >
              {step.description}
            </motion.p>
          </div>

          {/* Footer Controls */}
          <div className="px-8 pb-8 flex items-center justify-between">
            {/* Progress Dots */}
            <div className="flex space-x-2">
              {TUTORIAL_STEPS.map((_, idx) => (
                <div 
                  key={idx} 
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === currentStep ? 'w-6 bg-blue-500' : 'w-1.5 bg-[var(--border-secondary)]'
                  }`}
                />
              ))}
            </div>

            {/* Buttons */}
            <div className="flex space-x-3">
              {currentStep > 0 && (
                <button
                  onClick={handlePrev}
                  className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  <ChevronLeft size={20} />
                </button>
              )}
              <button
                onClick={handleNext}
                className="flex items-center px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-blue-500/20"
              >
                {isLastStep ? 'Get Started' : 'Next'}
                {!isLastStep && <ChevronRight size={16} className="ml-1" />}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
