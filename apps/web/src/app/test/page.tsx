'use client';

import { useDeviceDetect } from '@/hooks/useDeviceDetect';

export default function TestPage() {
  const { isMobile } = useDeviceDetect();

  if (isMobile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-status-open-soft to-brand-violet-soft flex items-center justify-center p-4">
        <div className="bg-surface-paper rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">📱</div>
          <h1 className="text-3xl font-bold text-status-open mb-4">
            Mobile UI Active!
          </h1>
          <p className="text-ink-700 mb-6">
            You are viewing the mobile version of the app.
          </p>
          <div className="bg-status-open-soft border-2 border-status-open rounded-lg p-4 text-left">
            <p className="text-sm font-mono text-status-open">
              <strong>Route:</strong> /test
            </p>
            <p className="text-sm font-mono text-status-open mt-2">
              <strong>Layout:</strong> Mobile Layout
            </p>
            <p className="text-sm font-mono text-status-open mt-2">
              <strong>Screen Width:</strong> {typeof window !== 'undefined' ? window.innerWidth : 0}px
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-violet-soft to-brand-violet-soft flex items-center justify-center p-4">
      <div className="bg-surface-paper rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
        <div className="text-6xl mb-4">💻</div>
        <h1 className="text-3xl font-bold text-brand-violet mb-4">
          Desktop UI Active!
        </h1>
        <p className="text-ink-700 mb-6">
          You are viewing the desktop version of the app.
        </p>
        <div className="bg-brand-violet-soft border-2 border-brand-violet rounded-lg p-4 text-left">
          <p className="text-sm font-mono text-brand-violet">
            <strong>Route:</strong> /test
          </p>
          <p className="text-sm font-mono text-brand-violet mt-2">
            <strong>Layout:</strong> Desktop Layout
          </p>
          <p className="text-sm font-mono text-brand-violet mt-2">
            <strong>Screen Width:</strong> {typeof window !== 'undefined' ? window.innerWidth : 0}px
          </p>
        </div>
        <div className="mt-6 p-4 bg-status-warning-soft border border-status-warning/20 rounded-lg">
          <p className="text-xs text-status-warning">
            💡 <strong>Tip:</strong> Open DevTools, enable mobile device emulation, and refresh to see the mobile version automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
