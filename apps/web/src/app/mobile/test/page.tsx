'use client';

export default function MobileTestPage() {
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
            <strong>Route:</strong> /mobile/test
          </p>
          <p className="text-sm font-mono text-green-800 mt-2">
            <strong>Layout:</strong> Mobile Layout
          </p>
        </div>
      </div>
    </div>
  );
}
