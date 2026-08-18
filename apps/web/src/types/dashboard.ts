import { Appointment } from "./appointment";

export interface AdminDashboardData {
  totalPatients: number;
  totalDoctors: number;
  totalAppointments: number;
  todayAppointments: number;
  pendingDoctors: number;
  revenue: number;
  occupancyRate: number;
  availableBeds: number;
  staffOnDuty: number;
  upcomingAppointments: Appointment[];
}

export interface DoctorDashboardData {
  todaysAppointments: number;
  completedAppointments: number;
  pendingAppointments: number;
  totalPatients: number;
  averageRating: number;
  nextAppointment: {
    patientName: string;
    time: string;
    type: string;
  } | null;
  upcomingAppointments: Appointment[];
  recentActivity: any[];
  specialization: string;
}