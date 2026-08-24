// app/unauthorized/page.jsx
'use client';

import { useRouter } from 'next/navigation';
import { Home, LogOut } from 'lucide-react';
import { useAuth } from "@/hooks/useAuth";

export default function UnauthorizedPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  console.log('Unauthorized page rendered', user);
  const handleGoHome = () => {
    router.push('/');
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full text-center">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Access Denied</h1>
          
          <p className="mt-2 text-gray-600">
            You don't have permission to access this page.
          </p>
          
          {user && (
            <p className="mt-1 text-sm text-gray-500">
              Your role: <span className="font-medium">{user.role}</span>
            </p>
          )}
          
          <div className="mt-6 space-y-3">
            <button
              onClick={handleGoHome}
              className="w-full flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </button>
            
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign In as Different User
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
