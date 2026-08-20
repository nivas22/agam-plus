'use client';

export default function MobileTestPage() {
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
            <strong>Route:</strong> /mobile/test
          </p>
          <p className="text-sm font-mono text-status-open mt-2">
            <strong>Layout:</strong> Mobile Layout
          </p>
        </div>
      </div>
    </div>
  );
}
