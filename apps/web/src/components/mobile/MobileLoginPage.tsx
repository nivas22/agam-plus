'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaGoogle, FaEnvelope, FaLock, FaHospital, FaUserCheck, FaExchangeAlt } from 'react-icons/fa';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { apiUrl } from '@/lib/api';
import toast from 'react-hot-toast';

export default function MobileLoginPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleGoogleSignIn = async () => {
    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      // Get the ID token
      const idToken = await result.user.getIdToken();
      
      // Call the login API to create session cookie
      const response = await fetch(apiUrl('/auth/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        throw new Error('Failed to create session');
      }

      const data = await response.json();
      
      toast.success('Login successful!');
      
      // Redirect based on hospital access - always use desktop routes
      if (data.hospitals && data.hospitals.length > 0) {
        router.push('/select-hospital');
      } else {
        router.push('/request-access');
      }
    } catch (error: any) {
      console.error('Google Sign-In error:', error);
      
      if (error.code === 'auth/popup-closed-by-user') {
        toast.error('Sign-in cancelled');
      } else if (error.code === 'auth/popup-blocked') {
        toast.error('Popup blocked. Please allow popups for this site');
      } else if (error.code === 'auth/account-exists-with-different-credential') {
        toast.error('Account exists with different sign-in method');
      } else {
        toast.error('Sign-in failed. Please try again');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex flex-col">
      {/* Main Content */}
      <div className="flex-1 flex flex-col justify-between px-6 py-8">
        {/* Top Section - Logo & Branding */}
        <div className="pt-12">
          <div className="flex flex-col items-center mb-8">
            <img 
              src="/agam-plus-logo.svg" 
              alt="Agam Plus Logo" 
              className="w-64 h-auto"
            />
          </div>
        </div>

        {/* Middle Section - Welcome & Sign In */}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-md">
            {/* Welcome Card */}
            <div className="bg-white rounded-3xl p-8 mb-6 shadow-xl border border-gray-200">
              <h2 className="text-3xl font-bold text-gray-800 mb-3 text-center">
                Welcome Back
              </h2>
              <p className="text-gray-600 text-center text-base mb-6">
                Sign in to access your hospitals
              </p>

              {/* Google Sign-In Button */}
              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 px-6 rounded-xl shadow-lg flex items-center justify-center gap-3 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Signing in...</span>
                  </div>
                ) : (
                  <>
                    <FaGoogle className="text-xl" />
                    <span>Continue with Google</span>
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-gray-300"></div>
                <span className="text-sm text-gray-500">or sign in with email</span>
                <div className="flex-1 h-px bg-gray-300"></div>
              </div>

              {/* Email Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email address
                </label>
                <div className="relative">
                  <FaEnvelope className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    disabled
                    placeholder="your.email@example.com"
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <FaLock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="password"
                    disabled
                    placeholder="••••••••"
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Forgot Password */}
              <div className="text-right mb-4">
                <button className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                  Forgot your password?
                </button>
              </div>

              {/* Email Login Coming Soon Badge */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6">
                <p className="text-sm text-amber-800 text-center font-medium">
                  Email Login Coming Soon
                </p>
              </div>

              {/* Request Access Link */}
              <div className="text-center">
                <p className="text-sm text-gray-600">
                  Don't have an account?{' '}
                  <button className="text-indigo-600 hover:text-indigo-700 font-semibold">
                    Request Access
                  </button>
                </p>
              </div>
            </div>

            {/* How it Works Section */}
            <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-200">
              <h3 className="text-lg font-bold text-gray-800 mb-4">How it works:</h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <FaGoogle className="text-indigo-600 mt-1 flex-shrink-0" />
                  <span className="text-sm text-gray-700">Sign in with your Google account</span>
                </li>
                <li className="flex items-start gap-3">
                  <FaHospital className="text-indigo-600 mt-1 flex-shrink-0" />
                  <span className="text-sm text-gray-700">Request access to hospitals you work with</span>
                </li>
                <li className="flex items-start gap-3">
                  <FaUserCheck className="text-indigo-600 mt-1 flex-shrink-0" />
                  <span className="text-sm text-gray-700">Hospital admins will approve your access</span>
                </li>
                <li className="flex items-start gap-3">
                  <FaExchangeAlt className="text-indigo-600 mt-1 flex-shrink-0" />
                  <span className="text-sm text-gray-700">Switch between hospitals anytime</span>
                </li>
              </ul>
            </div>

            {/* Terms Text */}
            <div className="mt-6 text-center">
              <p className="text-xs text-gray-500">
                By signing in, you agree to our{' '}
                <button className="text-indigo-600 hover:underline">Terms of Service</button>
                {' '}and{' '}
                <button className="text-indigo-600 hover:underline">Privacy Policy</button>
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Section - Footer */}
        <div className="text-center">
          <p className="text-sm text-gray-500">
            © 2024 Agam Plus. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
