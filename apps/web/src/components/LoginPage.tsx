'use client';

import { useState, useEffect } from 'react';
import { FcGoogle } from 'react-icons/fc';
import { useAuth } from '@/hooks/useAuth';
import { FaUserMd, FaEnvelope, FaLock, FaEye, FaEyeSlash, FaHospital } from 'react-icons/fa';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import './scss/LoginPage.scss';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [isEmailLoginEnabled, setIsEmailLoginEnabled] = useState(false);
  const isLoggingInWithEmail = false;
  
  const {
    user,
    loading,
    error,
    loginWithGoogle,
    isLoggingInWithGoogle,
    isAuthenticated,
    hospitals,
    approvedHospitals,
    currentHospital,
    handlePostLoginRedirect,
  } = useAuth();
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from');

  // Redirect if authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      // If there's a 'from' parameter, redirect back to that page
      if (from && from !== '/login') {
        router.push(from);
      } else if(approvedHospitals.length > 0) {
        handlePostLoginRedirect(approvedHospitals, router);
      }
      
    }
  }, [isAuthenticated, user, hospitals, approvedHospitals, currentHospital, from, router]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    
    if (!email || !password) {
      setLocalError('Please enter both email and password');
      return;
    }

    if (!isValidEmail(email)) {
      setLocalError('Please enter a valid email address');
      return;
    }

    setIsEmailLoginEnabled(false);

    // try {
    //   const result = await loginWithEmail({ email, password });
    //   if (!result.success) {
    //     setLocalError(result.error || 'Login failed');
    //   }
    // } catch (err: any) {
    //   setLocalError(err.message || 'An unexpected error occurred');
    // }
  };

  const handleGoogleLogin = async () => {
    setLocalError('');
    
    try {
      const result = await loginWithGoogle();
      if (!result.success) {
        setLocalError('Google login failed');
      }
    } catch (err: any) {
      setLocalError(err.message || 'An unexpected error occurred');
    }
  };

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const isLoading = isLoggingInWithGoogle || loading;
  const displayError = localError || error?.message;

  return (
    <div className="login-container">
      {/* Left side - Branding and information */}
      <div className="branding-section">
        <div className="branding-content">
          {/* Logo and App Name */}
          <div className="logo-section">
            <div className="logo-container">
              <img 
                src="/agam-plus-logo.svg" 
                alt="Agam Plus Logo" 
                className="app-logo"
              />
            </div>
          </div>

          {/* Features List */}
          <div className="features-list">
            <div className="feature-item">
              <div className="feature-icon feature-icon-blue">
                <FaHospital className="feature-icon-inner" />
              </div>
              <div className="feature-content">
                <h3 className="feature-title">Multi-Hospital Support</h3>
                <p className="feature-description">Work across multiple hospitals with single sign-on</p>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon feature-icon-green">
                <FaUserMd className="feature-icon-inner" />
              </div>
              <div className="feature-content">
                <h3 className="feature-title">Role-Based Access</h3>
                <p className="feature-description">Different permissions for admins, doctors, and staff</p>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon feature-icon-purple">
                <svg className="feature-icon-inner w-5 h-5 text-brand-violet" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                </svg>
              </div>
              <div className="feature-content">
                <h3 className="feature-title">Patient Records</h3>
                <p className="feature-description">Secure and organized patient information</p>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon feature-icon-orange">
                <svg className="feature-icon-inner w-5 h-5 text-status-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
              </div>
              <div className="feature-content">
                <h3 className="feature-title">Appointment Scheduling</h3>
                <p className="feature-description">Streamlined booking and management</p>
              </div>
            </div>
          </div>

          {/* Demo Information */}
          <div className="demo-info">
            <h4 className="demo-title">
              <FcGoogle className="demo-title-icon" />
              Quick Access
            </h4>
            <p className="demo-description">
              Sign in with Google to access the multi-hospital system. You can request access to multiple hospitals and switch between them seamlessly.
            </p>
          </div>

          {/* Hospital Count Info */}
          {isAuthenticated && hospitals.length > 0 && (
            <div className="hospital-status">
              <p className="hospital-status-text">
                Access to <strong>{approvedHospitals.length}</strong> approved hospitals
                {hospitals.length > approvedHospitals.length && (
                  <span> and <strong>{hospitals.length - approvedHospitals.length}</strong> pending</span>
                )}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="login-section">
        <div className="login-form-container">
          <div className="login-header">
            <h2 className="login-title">Welcome Back</h2>
            <p className="login-subtitle">Sign in to access your hospitals</p>
          </div>

          {/* Error Message */}
          {displayError && (
            <div className="error-message">
              {displayError}
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="loading-message">
              <div className="loading-content">
                <div className="loading-spinner"></div>
                Signing you in...
              </div>
            </div>
          )}

          {/* Google Login Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="google-button"
          >
            <FcGoogle className="text-xl" />
            <span>
              {isLoggingInWithGoogle ? 'Signing in...' : 'Continue with Google'}
            </span>
          </button>

          {/* Divider */}
          <div className="divider">
            <div className="divider-line"></div>
            <span className="divider-text">or sign in with email</span>
            <div className="divider-line"></div>
          </div>

          {/* Email Form */}
          <form className="space-y-4" onSubmit={handleEmailLogin}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-ink-700 mb-1">
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaEnvelope className="h-5 w-5 text-ink-500" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading || !isEmailLoginEnabled}
                  className="w-full pl-10 pr-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-violet focus:border-transparent disabled:bg-surface-canvas disabled:cursor-not-allowed transition-colors duration-200"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-ink-700 mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaLock className="h-5 w-5 text-ink-500" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading || !isEmailLoginEnabled}
                  className="w-full pl-10 pr-12 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-violet focus:border-transparent disabled:bg-surface-canvas disabled:cursor-not-allowed transition-colors duration-200"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  disabled={isLoading || !isEmailLoginEnabled}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-ink-500 hover:text-ink-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {showPassword ? <FaEyeSlash className="h-5 w-5" /> : <FaEye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Forgot Password Link */}
            <div className="flex justify-end">
              <Link 
                href="/forgot-password" 
                className="text-sm text-brand-violet hover:text-brand-violet-hover font-medium transition-colors duration-200"
              >
                Forgot your password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading || !isEmailLoginEnabled}
              className="w-full py-3 px-4 bg-brand-violet text-white rounded-xl font-medium hover:bg-brand-violet-hover transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-violet disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoggingInWithEmail ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-surface-paper border-t-transparent rounded-full animate-spin mr-2"></div>
                  Signing in...
                </div>
              ) : isEmailLoginEnabled ? (
                'Sign in with Email'
              ) : (
                'Email Login Coming Soon'
              )}
            </button>
          </form>

          {/* Registration Link */}
          <div className="mt-6 text-center">
            <p className="text-ink-700">
              Don&apos;t have an account?{' '}
              <Link 
                href="/register" 
                className="text-brand-violet hover:text-brand-violet-hover font-medium transition-colors duration-200"
              >
                Request Access
              </Link>
            </p>
          </div>

          {/* Hospital Access Info */}
          <div className="mt-6 p-4 bg-surface-canvas rounded-lg border border-border">
            <h4 className="text-sm font-medium text-ink-700 mb-2">How it works:</h4>
            <ul className="text-xs text-ink-700 space-y-1">
              <li>• Sign in with your Google account</li>
              <li>• Request access to hospitals you work with</li>
              <li>• Hospital admins will approve your access</li>
              <li>• Switch between hospitals anytime</li>
            </ul>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-sm text-ink-500">
              By signing in, you agree to our{" "}
              <Link href="/terms" className="text-brand-violet hover:text-brand-violet-hover font-medium">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-brand-violet hover:text-brand-violet-hover font-medium">
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
