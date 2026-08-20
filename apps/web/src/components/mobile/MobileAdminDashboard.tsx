'use client';

import { useRouter } from 'next/navigation';
import { 
  Users,
  Stethoscope,
  Calendar,
  AlertCircle,
  TrendingUp,
  History,
} from 'lucide-react';
import { useCurrentHospitalDashboard } from '@/hooks/useDashboardData';
import MobileLoadingSpinner from './MobileLoadingSpinner';

interface MobileAdminDashboardProps {
  hospitalId: string;
  hospitalName: string;
}

export default function MobileAdminDashboard({ 
  hospitalId,
  hospitalName 
}: MobileAdminDashboardProps) {
  const router = useRouter();
  const { formattedData, isLoading, error } = useCurrentHospitalDashboard();

  if (isLoading) {
    return <MobileLoadingSpinner message="Loading dashboard..." variant="admin" size="lg" />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="w-12 h-12 text-status-danger mb-3" />
        <p className="text-ink-700 text-sm font-medium">Failed to load dashboard</p>
      </div>
    );
  }

  const stats = [
    {
      label: 'Total Patients',
      value: formattedData?.totalPatients || '0',
      icon: Users,
      color: 'purple',
      bgColor: 'bg-brand-violet-soft',
      textColor: 'text-brand-violet',
      borderColor: 'border-brand-violet/20',
      route: `/mobile/hospital/${hospitalId}/patients`
    },
    {
      label: 'Total Doctors',
      value: formattedData?.totalDoctors || '0',
      icon: Stethoscope,
      color: 'indigo',
      bgColor: 'bg-brand-violet-soft',
      textColor: 'text-brand-violet',
      borderColor: 'border-brand-violet/20',
      route: `/mobile/hospital/${hospitalId}/doctors`
    },
    {
      label: "Today's Appointments",
      value: formattedData?.todayAppointments || '0',
      icon: Calendar,
      color: 'blue',
      bgColor: 'bg-brand-violet-soft',
      textColor: 'text-brand-violet',
      borderColor: 'border-brand-violet/20',
      route: `/mobile/hospital/${hospitalId}/appointments`
    },
    {
      label: 'Pending Doctors',
      value: formattedData?.pendingDoctors || '0',
      icon: AlertCircle,
      color: 'amber',
      bgColor: 'bg-status-warning-soft',
      textColor: 'text-status-warning',
      borderColor: 'border-status-warning/20',
      route: `/hospital/${hospitalId}/doctors?status=pending`
    }
  ];

  const quickActions = [
    {
      label: 'Patients',
      icon: Users,
      route: `/mobile/hospital/${hospitalId}/patients`,
      color: 'purple'
    },
    {
      label: 'Doctors',
      icon: Stethoscope,
      route: `/mobile/hospital/${hospitalId}/doctors`,
      color: 'indigo'
    },
    {
      label: 'Bookings',
      icon: Calendar,
      route: `/mobile/hospital/${hospitalId}/appointments`,
      color: 'blue'
    },
    {
      label: 'History',
      icon: History,
      route: `/mobile/hospital/${hospitalId}/attendance`,
      color: 'emerald'
    }
  ];

  return (
    <div className="min-h-screen bg-surface-canvas pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-brand-violet to-brand-violet-hover px-4 pt-6 pb-8">
        <div className="mb-6">
          <p className="text-brand-violet-soft text-sm mb-1">Welcome back</p>
          <h1 className="text-2xl font-bold text-white">{hospitalName}</h1>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <button
                key={index}
                onClick={() => router.push(stat.route)}
                className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 hover:bg-white/20 transition-all active:scale-95"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-10 h-10 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                    <Icon size={20} className={stat.textColor} />
                  </div>
                  {stat.label === 'Pending Doctors' && parseInt(stat.value) > 0 && (
                    <span className="px-2 py-0.5 bg-status-warning text-white text-xs font-bold rounded-full">
                      {stat.value}
                    </span>
                  )}
                </div>
                <p className="text-2xl font-bold text-white mb-1">{stat.value}</p>
                <p className="text-xs text-brand-violet-soft">{stat.label}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 -mt-4">
        <div className="bg-surface-paper rounded-xl shadow-sm border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-ink-900">Quick Actions</h2>
            <TrendingUp size={18} className="text-ink-500" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              const colorClasses = {
                purple: 'bg-brand-violet-soft text-brand-violet border-brand-violet/20',
                indigo: 'bg-brand-violet-soft text-brand-violet border-brand-violet/20',
                blue: 'bg-brand-violet-soft text-brand-violet border-brand-violet/20',
                emerald: 'bg-status-open-soft text-status-open border-status-open/20'
              };
              return (
                <button
                  key={index}
                  onClick={() => router.push(action.route)}
                  className={`flex items-center gap-2 p-3 rounded-lg border ${colorClasses[action.color as keyof typeof colorClasses]} hover:shadow-sm transition-all active:scale-95`}
                >
                  <Icon size={18} />
                  <span className="text-sm font-medium">{action.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="px-4 mt-4 space-y-3">
        {/* Total Appointments Card */}
        <div className="bg-surface-paper rounded-xl shadow-sm border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-ink-500 mb-1">Total Appointments</p>
              <p className="text-2xl font-bold text-ink-900">
                {formattedData?.totalAppointments || '0'}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-brand-violet-soft flex items-center justify-center">
              <Calendar size={24} className="text-brand-violet" />
            </div>
          </div>
        </div>

        {/* Management Section */}
        {/* <div className="bg-surface-paper rounded-xl shadow-sm border border-border overflow-hidden">
          <div className="px-4 py-3 bg-surface-canvas border-b border-border">
            <h3 className="text-sm font-semibold text-ink-900">Management</h3>
          </div>

          <button
            onClick={() => router.push(`/mobile/hospital/${hospitalId}/patients`)}
            className="w-full flex items-center justify-between px-4 py-3.5 border-b border-border active:bg-surface-canvas transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-violet-soft flex items-center justify-center">
                <Users size={20} className="text-brand-violet" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-ink-900">Manage Patients</p>
                <p className="text-xs text-ink-500">{formattedData?.totalPatients || '0'} total</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-ink-500" />
          </button>

          <button
            onClick={() => router.push(`/mobile/hospital/${hospitalId}/doctors`)}
            className="w-full flex items-center justify-between px-4 py-3.5 border-b border-border active:bg-surface-canvas transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-violet-soft flex items-center justify-center">
                <Stethoscope size={20} className="text-brand-violet" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-ink-900">Manage Doctors</p>
                <p className="text-xs text-ink-500">{formattedData?.totalDoctors || '0'} total</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-ink-500" />
          </button>

          <button
            onClick={() => router.push(`/mobile/hospital/${hospitalId}/appointments`)}
            className="w-full flex items-center justify-between px-4 py-3.5 active:bg-surface-canvas transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-violet-soft flex items-center justify-center">
                <Calendar size={20} className="text-brand-violet" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-ink-900">View Appointments</p>
                <p className="text-xs text-ink-500">{formattedData?.todayAppointments || '0'} today</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-ink-500" />
          </button>
        </div> */}
      </div>
    </div>
  );
}
