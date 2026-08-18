'use client';

import { useAuth } from '@/hooks/useAuth';
import { ReactNode } from 'react';

interface MobilePageWrapperProps {
  children: ReactNode;
  padding?: boolean;
  hideViewSwitch?: boolean;
}

export default function MobilePageWrapper({ 
  children, 
  padding = true,
  hideViewSwitch = false 
}: MobilePageWrapperProps) {
  const { isAdmin } = useAuth();

  // Light blue for admin, green for doctor
  const bgColor = isAdmin 
    ? 'bg-gradient-to-br from-blue-50 via-indigo-50 to-cyan-50'
    : 'bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50';

  const paddingClass = padding ? 'p-4' : '';

  return (
    <div className={`min-h-screen ${bgColor} ${paddingClass}`}>
      {hideViewSwitch && (
        <style jsx global>{`
          /* Hide view switch buttons on mobile pages */
          .view-switch-container {
            display: none !important;
          }
        `}</style>
      )}
      {children}
    </div>
  );
}
