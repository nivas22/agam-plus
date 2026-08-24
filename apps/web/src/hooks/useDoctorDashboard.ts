import { useQuery } from '@tanstack/react-query';
import { apiUrl, fetchWithAuth } from '@/lib/api';

export interface Appointment {
  id: string;
  patientName: string;
  patientPhone?: string;
  appointmentDate: Date;
  status?: string;
}

export interface Patient {
  id: string;
  name: string;
  phone?: string;
  address?: string;
}

export interface AppointmentStats {
  completed: number;
  scheduled: number;
  cancelled: number;
}

export interface DoctorDashboardData {
  doctorData: any;
  totalPatients: number;
  todayAppointments: number;
  upcomingAppointments: Appointment[];
  recentPatients: Patient[];
  appointmentStats: AppointmentStats;
}

async function fetchDoctorDashboard(): Promise<DoctorDashboardData> {
  const res = await fetchWithAuth(apiUrl('/doctor/dashboard'));
  if (!res.ok) throw new Error('Failed to fetch dashboard data');
  const data = await res.json();

  // Convert appointment dates to Date objects
  const upcomingAppointments: Appointment[] = data.upcomingAppointments.map((appt: any) => ({
    ...appt,
    appointmentDate: new Date(appt.appointmentDate),
  }));

  return {
    ...data,
    upcomingAppointments,
  };
}

export function useDoctorDashboard() {
  return useQuery<DoctorDashboardData, Error>({
    queryKey: ['doctorDashboard'],
    queryFn: fetchDoctorDashboard,
    staleTime: 1000 * 60, // 1 min
    refetchOnWindowFocus: true,
  });
}
