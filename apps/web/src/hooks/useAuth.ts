'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  loginWithGoogle,
  logout,
  onAuthStateChange,
} from '@/lib/auth';
import { apiUrl, fetchWithAuth } from '@/lib/api';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthData, AuthError, Hospital, LoginSuccess } from '@/types/auth';
import { HospitalMember } from '@/types/doctorNew';
import { MEMBERSHIP_STATUS, ROLE } from '@/constants';


// Query keys
export const authKeys = {
  all: ['auth'] as const,

  user: (): readonly ['auth', 'user'] => [...authKeys.all, 'user'],

  hospital: (hospitalId?: string): readonly ['auth', 'hospital', string] | readonly ['auth', 'hospital'] => {
    return hospitalId
      ? [...authKeys.all, 'hospital', hospitalId]
      : [...authKeys.all, 'hospital'];
  },
};


// API functions
export const authAPI = {
  getUser: async (): Promise<AuthData | null> => {
    try {
      const response = await fetchWithAuth(apiUrl('/auth/user'), {
        cache: 'no-store'
      });

      if (response.ok) {
        return await response.json();
      }
      
      if (response.status === 401) {
        return null;
      }
      
      console.error('User API error:', response.status);
      return null;
    } catch (error) {
      console.error('Error in authAPI.getUser:', error);
      return null;
    }
  },

  switchHospital: async (hospitalId: string): Promise<boolean> => {
    try {
      const response = await fetchWithAuth(apiUrl('/auth/hospital'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hospitalId }),
      });

      return response.ok;
    } catch (error) {
      console.error('Error switching hospital:', error);
      return false;
    }
  },

  getHospitalData: async (hospitalId: string): Promise<Hospital | null> => {
    try {
      const response = await fetchWithAuth(apiUrl(`/hospitals/${hospitalId}`));
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('Error fetching hospital data:', error);
      return null;
    }
  }
};

export function useAuth() {
  const queryClient = useQueryClient();
  const router = useRouter();

  // Auth data query
  const {
    data: authData,
    isLoading: userLoading,
    error: userError,
    refetch: refetchUser
  } = useQuery({
    queryKey: authKeys.user(),
    queryFn: authAPI.getUser,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
    enabled: true, // Always enabled to check auth on mount
  });

  // Derived states
  const user = authData?.user || null;
  const hospitals = authData?.hospitals || [];
  const currentHospital = authData?.currentHospital;

  // Current hospital membership
  const currentHospitalMembership = currentHospital 
    ? hospitals.find(h => h.hospitalId === currentHospital.id)
    : null;

  // Login mutations
  const googleLoginMutation = useMutation<LoginSuccess>({
    mutationFn: async () => {
      try {
        const result: LoginSuccess = await loginWithGoogle();

        return {
          success: true,
          user: result.user,
          userData: result.userData,
          role: result.role,
          hospitals: result.hospitals,
          currentHospital: result.currentHospital,
        };
      } catch (error: any) {
        throw new Error(error?.message || "Failed to login with Google");
      }
    },

    onSuccess: (data) => {
      queryClient.setQueryData(authKeys.user(), {
        user: data.user,
        hospitals: data.hospitals || [],
        currentHospital: data.currentHospital,
      });

      handlePostLoginRedirect(data.hospitals || [], router);
    },

    onError: (err: Error) => {
      console.error("Google login failed:", err.message);
    }
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(authKeys.user(), null);
      queryClient.removeQueries({ queryKey: authKeys.all });
      router.push('/login');
    },
  });

  // Hospital switching
  const switchHospitalMutation = useMutation({
    mutationFn: async (hospitalId: string): Promise<{ success: boolean; hospital?: Hospital }> => {
      const switchSuccess = await authAPI.switchHospital(hospitalId);
      if (switchSuccess) {
        const hospitalData = await authAPI.getHospitalData(hospitalId);
        return { success: true, hospital: hospitalData || undefined };
      }
      return { success: false };
    },
    onSuccess: (data) => {
      if (data.success) {
        // Refetch auth data to get updated hospital context
        queryClient.invalidateQueries({ queryKey: authKeys.user() });
        
        // If we have hospital data, update current hospital immediately
        if (data.hospital) {
          queryClient.setQueryData(authKeys.user(), (old: AuthData | undefined) => {
            if (!old) return old;
            return {
              ...old,
              currentHospital: data.hospital
            };
          });
        }
      }
    },
  });

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (firebaseUser) => {
      if (firebaseUser) {
        setTimeout(() => {
          refetchUser();
        }, 500);
      } else {
        queryClient.setQueryData(authKeys.user(), null);
        queryClient.removeQueries({ queryKey: authKeys.all });
      }
    });

    return unsubscribe;
  }, [queryClient, refetchUser]);

  const loading = userLoading || 
                  googleLoginMutation.isPending || 
                  logoutMutation.isPending;

  const error = googleLoginMutation.error || 
                logoutMutation.error || 
                userError;

  // Helper functions
  const isAuthenticated = !!user;
  
  const hasRole = (hospitalId: string, role: string) => {
    const membership = hospitals.find(h => h.hospitalId === hospitalId);
    return membership?.role === role;
  };

  const hasApprovedAccess = (hospitalId: string) => {
    const membership = hospitals.find(h => h.hospitalId === hospitalId);
    return membership?.status === MEMBERSHIP_STATUS.APPROVED;
  };

  const getCurrentHospitalRole = () => {
    return currentHospitalMembership?.role;
  };

  const getMembership = () => {
    return currentHospitalMembership;
  }

  const getCurrentHospitalStatus = () => {
    return currentHospitalMembership?.status || null;
  };

  // Dynamic route helpers
  const getHospitalRoute = (path: string, hospitalId?: string, isMobile?: boolean) => {
  const targetHospitalId = hospitalId || currentHospital?.id;
  if (!targetHospitalId) return '/select-hospital';
  
  // Remove any leading/trailing slashes and ensure proper formatting
  const cleanPath = path.replace(/^\/+|\/+$/g, '');
  return isMobile ? `/mobile/hospital/${targetHospitalId}/${cleanPath}` : 
  `/hospital/${targetHospitalId}/${cleanPath}`;
};

const navigateToHospitalRoute = (path: string, hospitalId?: string) => {
  const route = getHospitalRoute(path, hospitalId);
  router.push(route);
};

  // Role-based redirect paths
  const getRoleBasedRedirect = (hospitalId?: string, isMobile?: boolean) => {
    const targetHospitalId = hospitalId || currentHospital?.id;
    
    if (!targetHospitalId) {
      return '/select-hospital';
    }

    const membership = hospitals.find(h => h.hospitalId === targetHospitalId);
    
    if (!membership) {
      return '/select-hospital';
    }

    const { role, status, isProfileUpdated, isExperienceUpdated } = membership;

    switch (role) {
      case ROLE.ADMIN:
        return getHospitalRoute('/dashboard', targetHospitalId, isMobile);
      case ROLE.DOCTOR:

        if (status === MEMBERSHIP_STATUS.PENDING) {
          return '/select-hospital';
        }

        if(!isProfileUpdated || !isExperienceUpdated){
         return '/setup'
        }

        return getHospitalRoute('/dashboard', targetHospitalId, isMobile);
      case ROLE.STAFF:
        return status === MEMBERSHIP_STATUS.APPROVED
          ? getHospitalRoute('/dashboard', targetHospitalId)
          : '/select-hospital';
      case ROLE.PATIENT:
        return getHospitalRoute('/dashboard', targetHospitalId);
      default:
        return '/dashboard';
    }
  };

  // Check if user can access a specific hospital route
  const canAccessHospital = (hospitalId: string, requiredRole?: string) => {
    const membership = hospitals.find(h => h.hospitalId === hospitalId);
    
    if (!membership || membership.status !== MEMBERSHIP_STATUS.APPROVED) {
      return false;
    }

    if (requiredRole && membership.role !== requiredRole) {
      return false;
    }

    return true;
  };

  return {
    // Auth state
    user,
    hospitals,
    currentHospital,
    currentHospitalMembership,
    loading,
    error: error as AuthError | null,
    
    // Auth methods
    loginWithGoogle: googleLoginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    switchHospital: switchHospitalMutation.mutateAsync,
    refetchUser,
    
    // Mutation states
    isLoggingInWithGoogle: googleLoginMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
    isSwitchingHospital: switchHospitalMutation.isPending,
    
    // Helper functions
    isAuthenticated,
    hasRole,
    hasApprovedAccess,
    getCurrentHospitalRole,
    getCurrentHospitalStatus,
    getMembership,
    canAccessHospital,
    
    // Route helpers
    getHospitalRoute,
    navigateToHospitalRoute,
    getRoleBasedRedirect, 
    handlePostLoginRedirect,
    
    // Hospital helpers
    approvedHospitals: hospitals.filter(h => h.status === MEMBERSHIP_STATUS.APPROVED),
    pendingHospitals: hospitals.filter(h => h.status === MEMBERSHIP_STATUS.PENDING),
    rejectedHospitals: hospitals.filter(h => h.status === MEMBERSHIP_STATUS.REJECTED),
    
    // Current context
    isAdmin: getCurrentHospitalRole() === ROLE.ADMIN,
    isDoctor: getCurrentHospitalRole() === ROLE.DOCTOR,
    isStaff: getCurrentHospitalRole() === ROLE.STAFF,
    isPatient: getCurrentHospitalRole() === ROLE.PATIENT,
    isApproved: getCurrentHospitalStatus() === MEMBERSHIP_STATUS.APPROVED,
    isPending: getCurrentHospitalStatus() === MEMBERSHIP_STATUS.PENDING,
  };
}

// Helper function for post-login redirect
const handlePostLoginRedirect = (hospitals: HospitalMember[], router: any) => {
  const approvedHospital = hospitals.find(h => h.status === 'approved');
  
  if (approvedHospital) {
    const { role, hospitalId, isProfileUpdated, isExperienceUpdated } = approvedHospital;

    if(role === ROLE.DOCTOR){
      // Check if profile setup is incomplete
      if (!isProfileUpdated || !isExperienceUpdated) {
        router.push(`/setup`);
      } else {
        router.push(`/hospital/${hospitalId}/dashboard`);
      }
    } else if (role === ROLE.ADMIN) {
      router.push(`/hospital/${hospitalId}/dashboard`);
    } else {
      router.push(`/hospital/${hospitalId}/dashboard`);
    }
  } else if (hospitals.length > 0) {
    router.push('/select-hospital');
  } else {
    router.push('/select-hospital');
  }
}