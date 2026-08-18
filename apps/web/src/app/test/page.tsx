'use client';

import { useDeviceDetect } from '@/hooks/useDeviceDetect';

export default function TestPage() {
  const { isMobile } = useDeviceDetect();

  if (isMobile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">📱</div>
          <h1 className="text-3xl font-bold text-green-600 mb-4">
            Mobile UI Active!
          </h1>
          <p className="text-gray-600 mb-6">
            You are viewing the mobile version of the app.
          </p>
          <div className="bg-green-100 border-2 border-green-500 rounded-lg p-4 text-left">
            <p className="text-sm font-mono text-green-800">
              <strong>Route:</strong> /test
            </p>
            <p className="text-sm font-mono text-green-800 mt-2">
              <strong>Layout:</strong> Mobile Layout
            </p>
            <p className="text-sm font-mono text-green-800 mt-2">
              <strong>Screen Width:</strong> {typeof window !== 'undefined' ? window.innerWidth : 0}px
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
        <div className="text-6xl mb-4">💻</div>
        <h1 className="text-3xl font-bold text-blue-600 mb-4">
          Desktop UI Active!
        </h1>
        <p className="text-gray-600 mb-6">
          You are viewing the desktop version of the app.
        </p>
        <div className="bg-blue-100 border-2 border-blue-500 rounded-lg p-4 text-left">
          <p className="text-sm font-mono text-blue-800">
            <strong>Route:</strong> /test
          </p>
          <p className="text-sm font-mono text-blue-800 mt-2">
            <strong>Layout:</strong> Desktop Layout
          </p>
          <p className="text-sm font-mono text-blue-800 mt-2">
            <strong>Screen Width:</strong> {typeof window !== 'undefined' ? window.innerWidth : 0}px
          </p>
        </div>
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
          <p className="text-xs text-yellow-800">
            💡 <strong>Tip:</strong> Open DevTools, enable mobile device emulation, and refresh to see the mobile version automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
