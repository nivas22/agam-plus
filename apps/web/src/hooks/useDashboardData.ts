// hooks/useDashboardData.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useAuth } from './useAuth'; // Fixed import path
import { apiUrl, fetchWithAuth } from '@/lib/api';

// Base dashboard data types
export type BaseDashboardData = {
  totalPatients: number;
  totalDoctors: number;
  todayAppointments: number;
  pendingDoctors: number;
  totalAppointments: number;
};

export type HospitalDashboardData = BaseDashboardData & {
  revenue?: number;
  occupancyRate?: number;
  averageWaitTime?: number;
  availableBeds?: number;
  staffOnDuty?: number;
};

export type DoctorDashboardData = {
  todaysAppointments: number;
  completedAppointments: number;
  pendingAppointments: number;
  totalPatients: number;
  averageRating?: number;
  nextAppointment?: {
    patientName: string;
    time: string;
    type: string;
  };
  upcomingAppointments: Array<{
    id: string;
    patientName: string;
    time: string;
    status: string;
  }>;
  recentActivity: Array<{
    id: string;
    patientName: string;
    action: string;
    time: string;
  }>;
};

// Base API functions with hospital context
const dashboardApiFunctions = {
  // Hospital Admin Dashboard
  fetchHospitalDashboard: async (hospitalId: string): Promise<HospitalDashboardData> => {
    const response = await fetchWithAuth(apiUrl(`/hospitals/${hospitalId}/dashboard`));

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch hospital dashboard data');
    }

    return response.json();
  },

  // Doctor Dashboard
  fetchDoctorDashboard: async (hospitalId: string, doctorId?: string): Promise<DoctorDashboardData> => {
    const url = doctorId
      ? apiUrl(`/hospitals/${hospitalId}/doctors/${doctorId}/dashboard`)
      : apiUrl(`/hospitals/${hospitalId}/dashboard`);

    const response = await fetchWithAuth(url);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch doctor dashboard data');
    }

    return response.json();
  },

  // Admin Dashboard (for specific hospital)
  fetchAdminDashboard: async (hospitalId: string): Promise<HospitalDashboardData> => {
    const response = await fetchWithAuth(apiUrl(`/hospitals/${hospitalId}/dashboard`));

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch admin dashboard data');
    }

    return response.json();
  },

  // Multi-hospital overview
  fetchMultiHospitalOverview: async (): Promise<Record<string, HospitalDashboardData>> => {
    const response = await fetchWithAuth(apiUrl("/hospitals/overview"));

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch multi-hospital overview');
    }

    return response.json();
  },

  refreshHospitalDashboard: async (hospitalId: string): Promise<HospitalDashboardData> => {
    const response = await fetchWithAuth(apiUrl(`/hospitals/${hospitalId}/dashboard`), {
      headers: {
        'Cache-Control': 'no-cache',
      },
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to refresh hospital dashboard data');
    }
    
    return response.json();
  },
};

// TanStack Query keys with hospital context
export const dashboardKeys = {
  all: ['dashboard'] as const,
  hospital: (hospitalId: string) => [...dashboardKeys.all, 'hospital', hospitalId] as const,
  hospitalDetails: (hospitalId: string) => [...dashboardKeys.hospital(hospitalId), 'details'] as const,
  doctor: (hospitalId: string, doctorId?: string) => [
    ...dashboardKeys.all, 
    'doctor', 
    hospitalId, 
    ...(doctorId ? [doctorId] : [])
  ] as const,
  admin: (hospitalId: string) => [...dashboardKeys.all, 'admin', hospitalId] as const,
  multiHospital: () => [...dashboardKeys.all, 'multi-hospital'] as const,
};

// Individual query hooks

// Hook for hospital-specific dashboard data (Admin Role)
export const useHospitalDashboardData = (hospitalId?: string) => {
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useQuery({
    queryKey: dashboardKeys.hospitalDetails(actualHospitalId),
    queryFn: () => dashboardApiFunctions.fetchHospitalDashboard(actualHospitalId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // 10 minutes
    enabled: !!actualHospitalId,
  });
};

// Hook for doctor-specific dashboard data
export const useDoctorDashboardData = (hospitalId?: string, doctorId?: string) => {
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useQuery({
    queryKey: dashboardKeys.doctor(actualHospitalId, doctorId),
    queryFn: () => dashboardApiFunctions.fetchDoctorDashboard(actualHospitalId, doctorId),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    enabled: !!actualHospitalId,
  });
};

// Hook for admin dashboard (specific hospital)
export const useAdminDashboardData = (hospitalId?: string) => {
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useQuery({
    queryKey: dashboardKeys.admin(actualHospitalId),
    queryFn: () => dashboardApiFunctions.fetchAdminDashboard(actualHospitalId),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    enabled: !!actualHospitalId,
  });
};

// Hook for multi-hospital overview
export const useMultiHospitalOverview = () => {
  return useQuery({
    queryKey: dashboardKeys.multiHospital(),
    queryFn: dashboardApiFunctions.fetchMultiHospitalOverview,
    staleTime: 10 * 60 * 1000,
  });
};

// Main convenience hooks

// Hook for current hospital dashboard (Admin Role)
export const useCurrentHospitalDashboard = () => {
  const dashboardData = useHospitalDashboardData();

  // Enhanced error logging
  if (dashboardData.error) {
    console.error('Dashboard data error:', dashboardData.error);
  }

  return {
    // Data
    dashboardData: dashboardData.data,
    
    // Loading states
    isLoading: dashboardData.isLoading,
    isValidating: dashboardData.isFetching,
    
    // Error states
    error: dashboardData.error,
    
    // Refetch functions
    refetchDashboard: dashboardData.refetch,
    
    // Derived data with proper type safety and fallbacks
    formattedData: dashboardData.data ? {
      totalPatients: (dashboardData.data.totalPatients || 0).toLocaleString(),
      totalDoctors: (dashboardData.data.totalDoctors || 0).toLocaleString(),
      todayAppointments: (dashboardData.data.todayAppointments || 0).toLocaleString(),
      pendingDoctors: (dashboardData.data.pendingDoctors || 0).toLocaleString(),
      totalAppointments: (dashboardData.data.totalAppointments || 0).toLocaleString(),
      revenue: dashboardData.data.revenue ? `$${(dashboardData.data.revenue || 0).toLocaleString()}` : '$0',
      occupancyRate: dashboardData.data.occupancyRate ? `${dashboardData.data.occupancyRate}%` : '0%',
      averageWaitTime: dashboardData.data.averageWaitTime ? `${dashboardData.data.averageWaitTime} min` : '0 min',
      availableBeds: (dashboardData.data.availableBeds || 0).toLocaleString(),
      staffOnDuty: (dashboardData.data.staffOnDuty || 0).toLocaleString(),
    } : null,

    // Quick stats for cards with fallbacks
    quickStats: dashboardData.data ? [
      {
        label: 'Total Patients',
        value: (dashboardData.data.totalPatients || 0).toLocaleString(),
        change: '+12%',
        icon: 'patients',
      },
      {
        label: 'Active Doctors',
        value: (dashboardData.data.totalDoctors || 0).toLocaleString(),
        change: '+5%',
        icon: 'doctors',
      },
      {
        label: "Today's Appointments",
        value: (dashboardData.data.todayAppointments || 0).toLocaleString(),
        change: '+8%',
        icon: 'appointments',
      },
      {
        label: 'Pending Approvals',
        value: (dashboardData.data.pendingDoctors || 0).toLocaleString(),
        change: '-2%',
        icon: 'pending',
      },
    ] : [
      {
        label: 'Total Patients',
        value: '0',
        change: '+0%',
        icon: 'patients',
      },
      {
        label: 'Active Doctors',
        value: '0',
        change: '+0%',
        icon: 'doctors',
      },
      {
        label: "Today's Appointments",
        value: '0',
        change: '+0%',
        icon: 'appointments',
      },
      {
        label: 'Pending Approvals',
        value: '0',
        change: '+0%',
        icon: 'pending',
      },
    ],
  };
};

// Hook for current doctor dashboard (Doctor Role)
export const useCurrentDoctorDashboard = (doctorId?: string) => {
  const { id: hospitalId } = useParams();
  const dashboardData = useDoctorDashboardData(hospitalId as string, doctorId);

  if (!dashboardData) return {};

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = dashboardData;

  if (!data) {
    // Return only base states while data loads
    return {
      dashboardData: null,
      isLoading,
      isValidating: isFetching,
      error,
      refetchDashboard: refetch,
      formattedData: null,
      quickStats: [],
      upcomingAppointments: [],
      recentActivity: [],
      nextAppointment: null,
    };
  }

  // Derived fields (computed once)
  const {
    todaysAppointments,
    completedAppointments,
    pendingAppointments,
    totalPatients,
    averageRating,
    nextAppointment,
    upcomingAppointments,
    recentActivity,
  } = data;

  const formattedData = {
    todaysAppointments: (todaysAppointments ?? 0).toLocaleString(),
    completedAppointments: (completedAppointments ?? 0).toLocaleString(),
    pendingAppointments: (pendingAppointments ?? 0).toLocaleString(),
    totalPatients: (totalPatients ?? 0).toLocaleString(),
    averageRating: averageRating ? `${averageRating}/5` : "N/A",
    nextAppointment,
  };


  const quickStats = [
    {
      label: "Today's Appointments",
      value: (todaysAppointments ?? 0).toLocaleString(),
      change: "+3",
      icon: "calendar",
      color: "blue",
    },
    {
      label: "Completed Today",
      value: (completedAppointments ?? 0).toLocaleString(),
      change: "+2",
      icon: "check-circle",
      color: "green",
    },
    {
      label: "Pending",
      value: (pendingAppointments ?? 0).toLocaleString(),
      change: "+1",
      icon: "clock",
      color: "yellow",
    },
    {
      label: "Total Patients",
      value: (totalPatients ?? 0).toLocaleString(),
      change: "+15",
      icon: "users",
      color: "purple",
    },
  ];


  return {
    dashboardData: data,
    isLoading,
    isValidating: isFetching,
    error,
    refetchDashboard: refetch,

    formattedData,
    quickStats,

    upcomingAppointments: upcomingAppointments || [],
    recentActivity: recentActivity || [],
    nextAppointment,
  };
};

// Fixed custom hook for specific dashboard sections
export const useHospitalDashboardSection = (
  section: keyof HospitalDashboardData, 
  hospitalId?: string
) => {
  const { data, isLoading, error } = useHospitalDashboardData(hospitalId);

  // Proper type-safe formatting
  const formatValue = (value: any): string => {
    if (value == null) return 'N/A';
    
    switch (section) {
      case 'revenue':
        return `$${value.toLocaleString()}`;
      case 'occupancyRate':
        return `${value}%`;
      case 'averageWaitTime':
        return `${value} min`;
      default:
        return typeof value === 'number' ? value.toLocaleString() : String(value);
    }
  };

  return {
    data: data ? data[section] : null,
    isLoading,
    error,
    formatted: data && data[section] != null ? formatValue(data[section]) : 'N/A',
  };
};

// Hook for doctor dashboard sections
export const useDoctorDashboardSection = (
  section: keyof DoctorDashboardData,
  hospitalId?: string,
  doctorId?: string
) => {
  const { data, isLoading, error } = useDoctorDashboardData(hospitalId, doctorId);

  const formatValue = (value: any): string => {
    if (value == null) return 'N/A';
    
    if (typeof value === 'number') {
      return value.toLocaleString();
    }
    return String(value);
  };

  return {
    data: data ? data[section] : null,
    isLoading,
    error,
    formatted: data && data[section] != null ? formatValue(data[section]) : 'N/A',
  };
};

// Role-based dashboard hook
export const useRoleBasedDashboard = (role: string, doctorId?: string) => {
  // const params = useParams();
  // const hospitalId = params.id as string;

  // ❌ Previously conditional — now always called
  const adminDashboard = useCurrentHospitalDashboard();
  const doctorDashboard = useCurrentDoctorDashboard(doctorId);

  const isDoctor = role === "doctor";

  return {
    role: isDoctor ? "doctor" : "admin",
    data: isDoctor ? doctorDashboard.dashboardData : adminDashboard.dashboardData,
    formattedData: isDoctor ? doctorDashboard.formattedData : adminDashboard.formattedData,
    quickStats: isDoctor ? doctorDashboard.quickStats : adminDashboard.quickStats,
    isLoading: isDoctor ? doctorDashboard.isLoading : adminDashboard.isLoading,
    error: isDoctor ? doctorDashboard.error : adminDashboard.error,
    upcomingAppointments: isDoctor ? doctorDashboard.upcomingAppointments : undefined,
    recentActivity: isDoctor ? doctorDashboard.recentActivity : undefined,
    nextAppointment: isDoctor ? doctorDashboard.nextAppointment : undefined,
  };
};

// Utility hook to get dashboard based on user role from auth
export const useUserDashboard = () => {
  const { user, currentHospital, getCurrentHospitalRole } = useAuth();
  const params = useParams();
  const hospitalId = params.id as string;

  const userRole = getCurrentHospitalRole();
  const roleBasedDashboard = useRoleBasedDashboard(userRole as 'admin' | 'doctor', user?.id);

  return {
    ...roleBasedDashboard,
    userRole,
    hospitalId: hospitalId || currentHospital?.id,
    currentHospital,
  };
};

// Mutation hooks for manual refreshing
export const useRefreshHospitalDashboard = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return {
    refetch: () => queryClient.invalidateQueries({ 
      queryKey: dashboardKeys.hospitalDetails(actualHospitalId) 
    }),
    refresh: async () => {
      if (!actualHospitalId) throw new Error('Hospital ID is required');
      
      const data = await dashboardApiFunctions.refreshHospitalDashboard(actualHospitalId);
      queryClient.setQueryData(dashboardKeys.hospitalDetails(actualHospitalId), data);
      return data;
    },
  };
};

export const useInvalidateDashboard = () => {
  const queryClient = useQueryClient();

  return (hospitalId?: string) => {
    if (hospitalId) {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.hospital(hospitalId) });
    } else {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    }
  };
};

// Hook for real-time dashboard updates (WebSocket/polling)
export const useRealtimeDashboard = (hospitalId: string, interval: number = 30000) => {
  return useQuery({
    queryKey: [...dashboardKeys.hospitalDetails(hospitalId), 'realtime'],
    queryFn: () => dashboardApiFunctions.fetchHospitalDashboard(hospitalId),
    refetchInterval: interval,
    refetchIntervalInBackground: true,
    staleTime: 0, // Always consider stale to refetch
    enabled: !!hospitalId,
  });
};

// Utility hook to prefetch dashboard data
export const usePrefetchDashboard = () => {
  const queryClient = useQueryClient();

  return {
    prefetchHospital: (hospitalId: string) => {
      return queryClient.prefetchQuery({
        queryKey: dashboardKeys.hospitalDetails(hospitalId),
        queryFn: () => dashboardApiFunctions.fetchHospitalDashboard(hospitalId),
      });
    },
    prefetchMultipleHospitals: (hospitalIds: string[]) => {
      return Promise.all(
        hospitalIds.map(id =>
          queryClient.prefetchQuery({
            queryKey: dashboardKeys.hospitalDetails(id),
            queryFn: () => dashboardApiFunctions.fetchHospitalDashboard(id),
          })
        )
      );
    },
  };
};
