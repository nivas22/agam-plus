'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaHospital } from 'react-icons/fa';

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to login after 3 seconds
    const timer = setTimeout(() => {
      router.push('/login');
    }, 5000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-violet via-brand-violet to-brand-violet-hover flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Animated background circles */}
      <div className="absolute top-20 left-10 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-20 right-10 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      
      {/* Logo and branding */}
      <div className="relative z-10 text-center">
        {/* Logo */}
        <div className="mb-8 animate-bounce">
          <div className="w-32 h-32 mx-auto bg-white/20 backdrop-blur-lg rounded-3xl flex items-center justify-center shadow-2xl border-4 border-white/30">
            <FaHospital className="text-white text-6xl" />
          </div>
        </div>

        {/* App Name */}
        <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">
          Agam Plus
        </h1>
        
        {/* Tagline */}
        <p className="text-xl text-white/90 font-medium mb-8">
          Connect · Consult · Care
        </p>

        {/* Loading indicator */}
        <div className="flex justify-center items-center gap-2 mt-12">
          <div className="w-3 h-3 bg-white rounded-full animate-bounce"></div>
          <div className="w-3 h-3 bg-white rounded-full animate-bounce delay-150"></div>
          <div className="w-3 h-3 bg-white rounded-full animate-bounce delay-300"></div>
        </div>
      </div>

      {/* Footer text */}
      <div className="absolute bottom-8 text-center">
        <p className="text-white/70 text-sm">
          Powered by Agam Plus
        </p>
      </div>
    </div>
  );
}
