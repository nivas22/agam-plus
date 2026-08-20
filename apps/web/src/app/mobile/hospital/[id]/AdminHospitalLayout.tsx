'use client';

import { useState, useEffect, Suspense } from "react";
import { useRouter, usePathname, useParams } from "next/navigation";
import { ClipboardList, Calendar, LayoutDashboard, User as UserIcon } from "lucide-react";
import { FaHospital } from "react-icons/fa";
import { useAuth } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import { apiUrl, fetchWithAuth } from "@/lib/api";

interface HospitalLayoutProps {
  children: React.ReactNode;
  hospitalId?: string;
}

export default function MobileAdminHospitalLayout({
  children,
  hospitalId
}: HospitalLayoutProps) {
  const [pendingCount, setPendingCount] = useState(0);
  
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();

  const { currentHospital } = useAuth();

  const actualHospitalId = hospitalId || (params.id as string);

  // Dynamic navigation items with actual hospital ID
  const navItems = [
    { 
      to: '/dashboard',
      label: "Home", 
      icon: <LayoutDashboard size={18} /> 
    },
    // { 
    //   to: '/doctors',  
    //   label: "Doctors", 
    //   icon: <FaUserMd size={18} /> 
    // },
    // { 
    //   to: '/patients', 
    //   label: "Patients", 
    //   icon: <Users size={18} /> 
    // },
    { 
      to: '/appointments',
      label: "Bookings", 
      icon: <Calendar size={18} /> 
    },
    { 
      to: '/attendance',
      label: "Attendance",
      icon: <ClipboardList size={18} /> 
    },
  ];


  const navigateTo = (path: string) => {
    const fullPath = `/mobile/hospital/${actualHospitalId}${path}`;
    router.push(fullPath);
  };

  const isActive = (path: string) => {
    const fullPath = `/mobile/hospital/${actualHospitalId}${path}`;
    return pathname === fullPath || pathname.startsWith(`${fullPath}/`);
  };

  // Redirect to dashboard if accessing hospital root
  useEffect(() => {
    if (pathname === `/mobile/hospital/${actualHospitalId}`) {
      router.push(`/mobile/hospital/${actualHospitalId}/dashboard`);
    }
  }, [pathname, actualHospitalId, router]);

  // Fetch pending doctor requests count
  useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        const response = await fetchWithAuth(
          apiUrl(`/hospitals/${actualHospitalId}/pending-count`)
        );
        if (response.ok) {
          const data = await response.json();
          setPendingCount(data.count);
        }
      } catch (error) {
        console.error('Failed to fetch pending count:', error);
      }
    };

    if (actualHospitalId) {
      fetchPendingCount();
    }
  }, [actualHospitalId]);


  const currentSection = navItems.find((item) => isActive(item.to));
  const isProfilePage = pathname.includes('/profile');
  const isPatientsPage = pathname.includes('/patients');
  const isAvailabilityPage = pathname.includes('/add/availability');
  const isDoctorsPage = pathname.includes('/doctors');
  const isCreateAppointmentPage = pathname.includes('appointments/add');

  return (
    <ProtectedRoute requiredRole="admin">
      <div className="flex flex-col min-h-screen bg-surface-canvas">
        {/* Top Header - Hidden on Profile Page */}
        {!isProfilePage && !isPatientsPage && !isAvailabilityPage && !isDoctorsPage && !isCreateAppointmentPage && (
          <header className="sticky top-0 bg-surface-paper border-b border-border px-4 py-3 z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-violet-soft rounded-lg flex items-center justify-center">
                  <FaHospital className="text-brand-violet text-lg" />
                </div>
                <div>
                  <h1 className="text-base font-bold text-ink-900 truncate">
                    {currentHospital?.name || 'Hospital'}
                  </h1>
                  <p className="text-xs text-ink-500 truncate">
                    {currentSection ? currentSection.label : "Dashboard"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigateTo('/profile')}
                className="p-2 hover:bg-surface-canvas rounded-lg transition-colors active:scale-95"
                aria-label="Profile"
              >
                <UserIcon size={20} className="text-ink-700" />
              </button>
            </div>
          </header>
        )}

        {/* Main Content */}
        <main className={`flex-1 ${isProfilePage || isCreateAppointmentPage ? '' : 'pb-16'}`}>
          <div className="max-w-7xl mx-auto">
            <Suspense 
              key={pathname}
              fallback={
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-violet"></div>
                </div>
              }
            >
              {children}
            </Suspense>
          </div>
        </main>

        {/* Bottom Navigation Bar - Hidden on Profile and Add Appointment Pages */}
        {!isProfilePage && !isCreateAppointmentPage && (
          <nav className="fixed bottom-0 left-0 right-0 bg-surface-paper border-t border-border shadow-2xl z-40">
          <div className="flex items-center justify-around px-1 py-1.5">
            {navItems.slice(0, 5).map((item) => {
              const active = isActive(item.to);
              return (
                <button
                  key={item.to}
                  onClick={() => navigateTo(item.to)}
                  className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all duration-200 min-w-0 flex-1 relative ${
                    active
                      ? "text-brand-violet"
                      : "text-ink-500 hover:text-ink-700 active:scale-95"
                  }`}
                >
                  <div className={`relative ${active ? 'scale-110' : ''} transition-transform`}>
                    {item.icon}
                    {item.to.includes('/doctors') && pendingCount > 0 && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-status-danger rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                        {pendingCount > 9 ? '9+' : pendingCount}
                      </div>
                    )}
                  </div>
                  <span className={`text-[9px] font-medium truncate max-w-full leading-tight ${
                    active ? 'font-semibold' : ''
                  }`}>
                    {item.label}
                  </span>
                  {active && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-brand-violet rounded-t-full" />
                  )}
                </button>
              );
            })}
          </div>
        </nav>
        )}
      </div>
    </ProtectedRoute>
  );
}
