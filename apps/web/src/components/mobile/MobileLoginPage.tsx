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
    <div className="min-h-screen bg-gradient-to-br from-surface-canvas to-brand-violet-soft flex flex-col">
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
            <div className="bg-surface-paper rounded-3xl p-8 mb-6 shadow-xl border border-border">
              <h2 className="text-3xl font-bold text-ink-900 mb-3 text-center">
                Welcome Back
              </h2>
              <p className="text-ink-700 text-center text-base mb-6">
                Sign in to access your hospitals
              </p>

              {/* Google Sign-In Button */}
              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full bg-brand-violet hover:bg-brand-violet-hover text-white font-semibold py-4 px-6 rounded-xl shadow-lg flex items-center justify-center gap-3 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
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
                <div className="flex-1 h-px bg-border"></div>
                <span className="text-sm text-ink-500">or sign in with email</span>
                <div className="flex-1 h-px bg-border"></div>
              </div>

              {/* Email Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-ink-700 mb-2">
                  Email address
                </label>
                <div className="relative">
                  <FaEnvelope className="absolute left-4 top-1/2 transform -translate-y-1/2 text-ink-500" />
                  <input
                    type="email"
                    disabled
                    placeholder="your.email@example.com"
                    className="w-full pl-12 pr-4 py-3 border border-border rounded-xl bg-surface-canvas text-ink-500 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-ink-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <FaLock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-ink-500" />
                  <input
                    type="password"
                    disabled
                    placeholder="••••••••"
                    className="w-full pl-12 pr-4 py-3 border border-border rounded-xl bg-surface-canvas text-ink-500 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Forgot Password */}
              <div className="text-right mb-4">
                <button className="text-sm text-brand-violet hover:text-brand-violet-hover font-medium">
                  Forgot your password?
                </button>
              </div>

              {/* Email Login Coming Soon Badge */}
              <div className="bg-status-warning-soft border border-status-warning/20 rounded-xl p-3 mb-6">
                <p className="text-sm text-status-warning text-center font-medium">
                  Email Login Coming Soon
                </p>
              </div>

              {/* Request Access Link */}
              <div className="text-center">
                <p className="text-sm text-ink-700">
                  Don't have an account?{' '}
                  <button className="text-brand-violet hover:text-brand-violet-hover font-semibold">
                    Request Access
                  </button>
                </p>
              </div>
            </div>

            {/* How it Works Section */}
            <div className="bg-surface-paper rounded-3xl p-6 shadow-xl border border-border">
              <h3 className="text-lg font-bold text-ink-900 mb-4">How it works:</h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <FaGoogle className="text-brand-violet mt-1 flex-shrink-0" />
                  <span className="text-sm text-ink-700">Sign in with your Google account</span>
                </li>
                <li className="flex items-start gap-3">
                  <FaHospital className="text-brand-violet mt-1 flex-shrink-0" />
                  <span className="text-sm text-ink-700">Request access to hospitals you work with</span>
                </li>
                <li className="flex items-start gap-3">
                  <FaUserCheck className="text-brand-violet mt-1 flex-shrink-0" />
                  <span className="text-sm text-ink-700">Hospital admins will approve your access</span>
                </li>
                <li className="flex items-start gap-3">
                  <FaExchangeAlt className="text-brand-violet mt-1 flex-shrink-0" />
                  <span className="text-sm text-ink-700">Switch between hospitals anytime</span>
                </li>
              </ul>
            </div>

            {/* Terms Text */}
            <div className="mt-6 text-center">
              <p className="text-xs text-ink-500">
                By signing in, you agree to our{' '}
                <button className="text-brand-violet hover:underline">Terms of Service</button>
                {' '}and{' '}
                <button className="text-brand-violet hover:underline">Privacy Policy</button>
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Section - Footer */}
        <div className="text-center">
          <p className="text-sm text-ink-500">
            © 2024 Agam Plus. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
