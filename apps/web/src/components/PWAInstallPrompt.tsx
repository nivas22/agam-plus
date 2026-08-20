'use client';

import { useState, useEffect } from 'react';
import { FaTimes, FaDownload } from 'react-icons/fa';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Check if user has dismissed the prompt before
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (!dismissed) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowPrompt(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    }

    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 animate-slide-up">
      <div className="bg-surface-paper rounded-2xl shadow-2xl border border-border p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-brand-violet-soft rounded-xl flex items-center justify-center">
              <img
                src="/agam-plus-logo.svg"
                alt="Agam Plus"
                className="w-8 h-8"
              />
            </div>
            <div>
              <h3 className="font-bold text-ink-900">Install Agam Plus</h3>
              <p className="text-sm text-ink-700">Add to your home screen</p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-ink-500 hover:text-ink-700 transition-colors"
            aria-label="Dismiss"
          >
            <FaTimes className="text-xl" />
          </button>
        </div>

        <p className="text-sm text-ink-700 mb-4">
          Install our app for quick access and a better experience. Works offline!
        </p>

        <div className="flex gap-3">
          <button
            onClick={handleInstall}
            className="flex-1 bg-brand-violet hover:bg-brand-violet-hover text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <FaDownload />
            <span>Install</span>
          </button>
          <button
            onClick={handleDismiss}
            className="px-4 py-3 text-ink-700 hover:text-ink-900 font-medium transition-colors"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
