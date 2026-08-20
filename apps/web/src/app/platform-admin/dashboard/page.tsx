'use client';

import { useQuery } from '@tanstack/react-query';
import { apiUrl, fetchWithAuth } from '@/lib/api';
import { Building2, Calendar, LayoutDashboard, Stethoscope, Users } from 'lucide-react';

interface PlatformStats {
  totalHospitals: number;
  totalUsers: number;
  totalDoctors: number;
  totalPatients: number;
  totalAppointments: number;
}

async function fetchStats(): Promise<PlatformStats> {
  const response = await fetchWithAuth(apiUrl('/platform-admin/stats'));
  if (!response.ok) throw new Error('Failed to load stats');
  return response.json();
}

export default function PlatformAdminDashboardPage() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['platform-admin', 'stats'],
    queryFn: fetchStats,
  });

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-brand-violet-soft rounded-xl">
          <LayoutDashboard className="w-7 h-7 text-brand-violet" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Platform Overview</h1>
          <p className="text-ink-500 text-sm">Stats across all hospitals</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-violet" />
        </div>
      ) : error ? (
        <div className="text-center text-status-danger py-10">Failed to load dashboard data</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard icon={<Building2 className="w-5 h-5 text-brand-violet" />} label="Total Hospitals" value={stats?.totalHospitals ?? 0} color="violet" />
          <StatCard icon={<Users className="w-5 h-5 text-status-open" />} label="Total Users" value={stats?.totalUsers ?? 0} color="open" />
          <StatCard icon={<Stethoscope className="w-5 h-5 text-brand-violet" />} label="Total Doctors" value={stats?.totalDoctors ?? 0} color="violet" />
          <StatCard icon={<Users className="w-5 h-5 text-status-warning" />} label="Total Patients" value={stats?.totalPatients ?? 0} color="warning" />
          <StatCard icon={<Calendar className="w-5 h-5 text-status-open" />} label="Total Appointments" value={stats?.totalAppointments ?? 0} color="open" />
        </div>
      )}
    </div>
  );
}

type StatCardProps = {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'violet' | 'open' | 'warning' | 'danger';
};

const STAT_CARD_CHIP_BG: Record<StatCardProps['color'], string> = {
  violet: 'bg-brand-violet-soft',
  open: 'bg-status-open-soft',
  warning: 'bg-status-warning-soft',
  danger: 'bg-status-danger-soft',
};

function StatCard({ icon, label, value, color }: StatCardProps) {
  return (
    <div className="bg-surface-paper p-5 rounded-xl shadow-sm border border-border">
      <div className="flex items-center gap-3">
        <div className={`p-2 ${STAT_CARD_CHIP_BG[color]} rounded-lg`}>{icon}</div>
        <div>
          <p className="text-sm text-ink-500">{label}</p>
          <h2 className="text-2xl font-bold text-ink-900">{value}</h2>
        </div>
      </div>
    </div>
  );
}
