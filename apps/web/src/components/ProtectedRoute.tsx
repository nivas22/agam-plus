'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
  requireApproved?: boolean;
  loadingComponent?: React.ReactNode;
}

export default function ProtectedRoute({ 
  children, 
  requiredRole = '',
  requireApproved = true,
  loadingComponent = null 
}: ProtectedRouteProps) {
  const { 
    user, 
    currentHospital, 
    loading, 
    isAuthenticated, 
    hasRole, 
    hasApprovedAccess,
    canAccessHospital,
    getRoleBasedRedirect 
  } = useAuth();
  
  const router = useRouter();
  const params = useParams();
  const hospitalId = params.id as string;

  useEffect(() => {
    if (!loading) {
      // Redirect to login if not authenticated
      if (!isAuthenticated || !user) {
        const currentPath = window.location.pathname;
        router.push(`/login?from=${encodeURIComponent(currentPath)}`);
        return;
      }

      // If hospital context is required but no hospital selected and no hospitalId in URL
      if (requireApproved && !currentHospital && !hospitalId) {
        router.push('/select-hospital');
        return;
      }

      // If we have a hospitalId in URL, check access to that specific hospital
      if (hospitalId) {
        if (!canAccessHospital(hospitalId, requiredRole)) {
          const redirectPath = getRoleBasedRedirect();
          router.push(redirectPath);
          return;
        }
      }

      // For routes without hospitalId but requiring hospital context
      if (requireApproved && !currentHospital && !hospitalId) {
        router.push('/select-hospital');
        return;
      }

      // Check role requirements for current hospital (when no specific hospitalId in URL)
      if (currentHospital && !hospitalId && requiredRole) {
        if (!hasRole(currentHospital.id, requiredRole)) {
          router.push('/unauthorized');
          return;
        }
      }

      // Check if approved access is required
      if ((currentHospital || hospitalId) && requireApproved) {
        const targetHospitalId = hospitalId || currentHospital?.id;
        if (targetHospitalId && !hasApprovedAccess(targetHospitalId)) {
          router.push('/select-hospital');
          return;
        }
      }
    }
  }, [
    user, 
    currentHospital, 
    loading, 
    isAuthenticated, 
    requiredRole, 
    requireApproved, 
    router, 
    hasRole, 
    hasApprovedAccess,
    canAccessHospital,
    getRoleBasedRedirect,
    hospitalId
  ]);

  // Show loading state
  if (loading) {
    return loadingComponent || (
      <div className="flex justify-center items-center min-h-screen">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated
  if (!isAuthenticated || !user) {
    return null;
  }

  // Check hospital access when hospitalId is in URL
  if (hospitalId) {
    if (!canAccessHospital(hospitalId, requiredRole)) {
      return null;
    }
    if (requireApproved && !hasApprovedAccess(hospitalId)) {
      return null;
    }
  } else {
    // For routes without specific hospitalId
    if (requireApproved && !currentHospital) {
      return null;
    }
    if (currentHospital && requiredRole && !hasRole(currentHospital.id, requiredRole)) {
      return null;
    }
    if (currentHospital && requireApproved && !hasApprovedAccess(currentHospital.id)) {
      return null;
    }
  }

  return <>{children}</>;
}
