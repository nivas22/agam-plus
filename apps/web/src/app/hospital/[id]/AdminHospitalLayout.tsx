'use client';

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, usePathname, useParams } from "next/navigation";
import { Menu, X, Users, ClipboardList, LogOut, Calendar, LayoutDashboard, ChevronDown, Check, User as UserIcon, Plus } from "lucide-react";
import { FaUserMd, FaHospital } from "react-icons/fa";
import { useAuth } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import { apiUrl, fetchWithAuth } from "@/lib/api";

interface HospitalLayoutProps {
  children: React.ReactNode;
  hospitalId?: string;
}

export default function AdminHospitalLayout({
  children,
  hospitalId
}: HospitalLayoutProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [showHospitalSwitcher, setShowHospitalSwitcher] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    user: userData,
    currentHospital,
    logout,
    navigateToHospitalRoute,
    approvedHospitals,
    switchHospital,
    isSwitchingHospital,
    getRoleBasedRedirect
  } = useAuth();

  const actualHospitalId = hospitalId || (params.id as string);
  const displayName = userData?.name || userData?.email;

  // Dynamic navigation items with actual hospital ID
  const navItems = [
  { 
    to: '/dashboard',
    label: "Dashboard", 
    icon: <LayoutDashboard size={18} /> 
  },
  { 
    to: '/doctors',  
    label: "Doctors", 
    icon: <FaUserMd size={18} /> 
  },
  { 
    to: '/patients', 
    label: "Patients", 
    icon: <Users size={18} /> 
  },
  { 
    to: '/appointments',
    label: "Appointments", 
    icon: <Calendar size={18} /> 
  },
  { 
    to: '/attendance',
    label: "Attendance", 
    icon: <ClipboardList size={18} /> 
  },
];

  const toggleMenu = () => setIsOpen(!isOpen);

  const navigateTo = (path: string) => {
    const fullPath = `/hospital/${actualHospitalId}${path}`;
    router.push(fullPath);
    setIsOpen(false);
  };

  const isActive = (path: string) => {
    const fullPath = `/hospital/${actualHospitalId}${path}`;
    return pathname === fullPath || pathname.startsWith(`${fullPath}/`);
  };

  // const linkClasses = (active: boolean) =>
  //   `group relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 w-full text-left ${
  //     active
  //       ? "bg-white/15 text-white shadow-sm"
  //       : "text-white/70 hover:bg-white/10 hover:text-white hover:shadow-sm"
  //   }`;

  const handleHospitalSwitch = async (newHospitalId: string) => {
    if (newHospitalId === actualHospitalId) {
      setShowHospitalSwitcher(false);
      return;
    }

    try {
      await switchHospital(newHospitalId);
      const redirectPath = getRoleBasedRedirect(newHospitalId);
      router.push(redirectPath);
      setShowHospitalSwitcher(false);
    } catch (error) {
      console.error('Failed to switch hospital:', error);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setShowHospitalSwitcher(false);
      }
    };

    if (showHospitalSwitcher) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showHospitalSwitcher]);

  // Redirect to dashboard if accessing hospital root
  useEffect(() => {
    if (pathname === `/hospital/${actualHospitalId}`) {
      router.push(`/hospital/${actualHospitalId}/dashboard`);
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

  return (
    <ProtectedRoute requiredRole="admin">
      <div className="flex min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        {/* Debug indicator - remove after testing */}
        <div className="fixed top-2 right-2 z-[100] bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
          💻 DESKTOP
        </div>
        
        {/* Desktop Sidebar */}
        <aside
          className="hidden md:flex md:flex-col bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700 text-white fixed h-full transition-all duration-300 ease-in-out shadow-2xl backdrop-blur-lg border-r border-white/10 z-50"
          style={{ width: sidebarExpanded ? '280px' : '75px' }}
        >
          {/* Logo/Brand Section */}
          <div className="p-4 border-b border-white/10">
            <button
              onClick={() => navigateToHospitalRoute('/profile')}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/10 transition-all duration-200 w-full ${
                sidebarExpanded ? '' : 'justify-center'
              }`}
            >
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0 shadow-md">
                <FaHospital className="text-white text-lg" />
              </div>
              {sidebarExpanded && (
                <div className="flex-1 min-w-0 text-left">
                  <h1 className="text-base font-bold text-white truncate">
                    Agam Plus
                  </h1>
                  <p className="text-xs text-white/70 font-medium truncate">
                    Admin - {displayName}
                  </p>
                </div>
              )}
              {sidebarExpanded && (
                <UserIcon size={14} className="text-white/60 flex-shrink-0" />
              )}
            </button>
            {/* Toggle Button */}
            <button
              onClick={() => setSidebarExpanded(!sidebarExpanded)}
              className="absolute -right-3 top-20 bg-white text-indigo-600 rounded-full p-1.5 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 border-2 border-indigo-600"
              aria-label={sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
            >
              <svg
                className={`w-4 h-4 transition-transform duration-300 ${sidebarExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1.5">
            {navItems.map((item) => {
              const active = isActive(item.to);
              return (
                <button
                  key={item.to}
                  onClick={() => navigateTo(item.to)}
                  className={`group relative flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 w-full text-left ${
                    active
                      ? "bg-white/20 text-white shadow-lg backdrop-blur-md border border-white/30"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  }`}
                  title={!sidebarExpanded ? item.label : undefined}
                  aria-label={item.label}
                >
                  {/* Active indicator */}
                  {active && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-r-full" />
                  )}
                  
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                      active 
                        ? 'bg-white/30 text-white' 
                        : 'bg-white/10 text-white/80 group-hover:bg-white/20 group-hover:text-white'
                    }`}>
                      {item.icon}
                    </div>
                    {sidebarExpanded && (
                      <span className={`text-sm font-medium truncate ${
                        active ? 'font-semibold' : ''
                      }`}>
                        {item.label}
                      </span>
                    )}
                    {item.to.includes('/doctors') && pendingCount > 0 && sidebarExpanded && (
                      <span className="ml-auto bg-gradient-to-r from-red-500 to-rose-600 text-white px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0 shadow-lg ring-2 ring-red-400/30">
                        {pendingCount}
                      </span>
                    )}
                    {item.to.includes('/doctors') && pendingCount > 0 && !sidebarExpanded && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-red-500 to-rose-600 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg ring-2 ring-red-400/30">
                        {pendingCount}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Hospital Switcher */}
          <div className="border-t border-white/10 p-3 relative" ref={dropdownRef}>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowHospitalSwitcher((prev) => !prev);
              }}
              type="button"
              className="flex items-center gap-3 w-full hover:bg-white/10 rounded-xl px-3 py-2.5 transition-all duration-300 hover:shadow-lg group relative overflow-hidden"
              disabled={isSwitchingHospital}
            >
              {/* Subtle background animation on hover */}
              <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              
              <div className="w-10 h-10 bg-gradient-to-br from-blue-400 via-indigo-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg group-hover:shadow-xl group-hover:scale-105 transition-all duration-300 relative z-10 ring-2 ring-white/30">
                <FaHospital className="text-white text-base drop-shadow-sm" />
              </div>
              {sidebarExpanded && (
                <div className="flex-1 min-w-0 text-left relative z-10">
                  <div className="text-sm font-bold truncate text-white/95">
                    {currentHospital?.name || 'Hospital'}
                  </div>
                  <div className="text-xs text-white/60 font-medium mt-0.5">
                    {approvedHospitals.length} hospital{approvedHospitals.length !== 1 ? 's' : ''}
                  </div>
                </div>
              )}
              {approvedHospitals.length >= 1 && (
                <ChevronDown
                  size={16}
                  className={`text-white/80 transition-all duration-300 flex-shrink-0 relative z-10 ${
                    sidebarExpanded ? 'ml-auto' : ''
                  } ${showHospitalSwitcher ? 'rotate-180 text-white' : 'group-hover:text-white'}`}
                />
              )}
            </button>

            {/* Hospital Dropdown */}
            {showHospitalSwitcher && approvedHospitals.length >= 1 && (
              <div
                className="absolute bottom-full left-3 right-3 mb-3 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden z-[99999] animate-slide-down border border-white/20"
                style={{
                  width: sidebarExpanded ? 'calc(100% - 1.5rem)' : '280px',
                  left: sidebarExpanded ? '0.75rem' : 'calc(100% + 0.75rem)',
                  minWidth: '280px'
                }}
              >
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 px-4 py-3 border-b border-white/10">
                  <div className="text-white font-bold text-sm flex items-center gap-2">
                    <FaHospital className="text-white/90" />
                    <span>Switch Hospital</span>
                  </div>
                  <div className="text-white/70 text-xs mt-0.5">
                    {approvedHospitals.length} available
                  </div>
                </div>

                {/* Hospital List */}
                <div className="py-2 max-h-72 overflow-y-auto px-2">
                  {approvedHospitals.map((hospital, index) => {
                    const isActiveHospital = hospital.hospitalId === actualHospitalId;
                    return (
                      <button
                        key={hospital.hospitalId}
                        onClick={() => handleHospitalSwitch(hospital.hospitalId)}
                        disabled={isSwitchingHospital || isActiveHospital}
                        className={`w-full px-3 py-3 flex items-center gap-3 transition-all duration-200 text-left rounded-xl mb-1.5 group relative overflow-hidden ${
                          isActiveHospital
                            ? 'bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 shadow-md ring-2 ring-indigo-200'
                            : 'hover:bg-gradient-to-r hover:from-gray-50 hover:to-indigo-50 text-gray-700 hover:shadow-md hover:scale-[1.02]'
                        }`}
                        style={{
                          animationDelay: `${index * 50}ms`
                        }}
                      >
                        {/* Active indicator line */}
                        {isActiveHospital && (
                          <div className="absolute left-0 top-2 bottom-2 w-1 bg-gradient-to-b from-indigo-500 to-purple-600 rounded-r-full" />
                        )}
                        
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md transition-all duration-200 ${
                            isActiveHospital
                              ? 'bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600 shadow-lg scale-105'
                              : 'bg-gradient-to-br from-gray-300 to-gray-400 group-hover:from-indigo-400 group-hover:to-purple-500 group-hover:scale-105'
                          }`}
                        >
                          <FaHospital className="text-white text-sm" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-bold truncate ${isActiveHospital ? 'text-indigo-900' : 'text-gray-800'}`}>
                            {hospital.hospital.name}
                          </div>
                          <div className={`text-xs capitalize font-medium mt-0.5 ${
                            isActiveHospital ? 'text-indigo-600' : 'text-gray-500'
                          }`}>
                            {hospital.role} • {hospital.hospital.address || 'Location'}
                          </div>
                        </div>
                        {isActiveHospital && (
                          <div className="flex-shrink-0 w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center shadow-md">
                            <Check size={14} className="text-white font-bold" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-100 bg-gradient-to-r from-gray-50 to-indigo-50 p-2 space-y-1.5">
                  <button
                    onClick={() => {
                      router.push('/select-hospital');
                      setShowHospitalSwitcher(false);
                    }}
                    className="w-full px-3 py-2.5 text-sm font-bold text-indigo-600 hover:text-indigo-700 hover:bg-white/80 rounded-xl transition-all duration-200 text-center flex items-center justify-center gap-2 group"
                  >
                    <span>View All Hospitals</span>
                    <span className="group-hover:translate-x-1 transition-transform duration-200">→</span>
                  </button>
                  <button
                    onClick={() => {
                      router.push('/request-access');
                      setShowHospitalSwitcher(false);
                    }}
                    className="w-full px-3 py-2.5 text-sm font-bold text-purple-600 hover:text-purple-700 hover:bg-white/80 rounded-xl transition-all duration-200 text-center flex items-center justify-center gap-2 group"
                  >
                    <Plus size={16} className="flex-shrink-0" />
                    <span>Select New Hospital</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Logout Button */}
          <div className="border-t border-white/10 p-3">
            {sidebarExpanded ? (
              <button
                onClick={() => logout()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm text-white hover:bg-red-500/20 hover:shadow-sm transition-all duration-200 font-semibold border border-white/20"
              >
                <LogOut size={18} />
                <span>Sign Out</span>
              </button>
            ) : (
              <button
                onClick={() => logout()}
                className="w-full flex items-center justify-center p-2.5 rounded-lg text-white hover:bg-red-500/20 hover:shadow-sm transition-all duration-200 border border-white/20"
                title="Sign Out"
              >
                <LogOut size={18} />
              </button>
            )}
          </div>
        </aside>

        {/* Mobile Navbar */}
        <div className="md:hidden fixed top-0 left-0 right-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white flex items-center justify-between px-4 py-4 shadow-2xl z-50 backdrop-blur-lg border-b border-white/10">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleMenu}
              className="hover:bg-white/15 p-2.5 rounded-xl transition-all duration-300 flex items-center justify-center shadow-md hover:shadow-lg hover:scale-105 active:scale-95"
              aria-label={isOpen ? "Close menu" : "Open menu"}
            >
              {isOpen ? (
                <X size={24} className="text-white" />
              ) : (
                <Menu size={24} className="text-white" />
              )}
            </button>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-base font-bold truncate text-white">
                Agam Plus - {currentHospital?.name || 'Hospital'}
              </span>
              <span className="text-xs text-white/70 font-medium truncate">
                {currentSection ? currentSection.label : "Dashboard"}
              </span>
            </div>
          </div>
        </div>

        {/* Mobile Menu Drawer */}
        <div
          className={`fixed inset-0 z-40 md:hidden transition-all duration-300 ${
            isOpen ? "pointer-events-auto" : "pointer-events-none"
          }`}
        >
          {/* Overlay */}
          <div
            className={`absolute inset-0 bg-black bg-opacity-40 transition-opacity duration-300 ${
              isOpen ? "opacity-100" : "opacity-0"
            }`}
            onClick={toggleMenu}
          />

          {/* Drawer */}
          <aside
            className={`absolute top-0 left-0 w-80 h-full bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700 text-white shadow-2xl p-6 transform transition-transform duration-300 flex flex-col border-r border-white/10 ${
              isOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            {/* Header */}
            <div className="mt-20 mb-6">
              <button
                onClick={() => {
                  navigateTo('/profile');
                  toggleMenu();
                }}
                className="w-full bg-white/10 backdrop-blur-md rounded-xl p-4 shadow-lg border border-white/20 hover:bg-white/15 transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center shadow-md">
                    <FaHospital className="text-white text-lg" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <h2 className="text-base font-bold text-white">Agam Plus</h2>
                    <p className="text-sm text-white/80 truncate">Admin - {displayName}</p>
                  </div>
                  <UserIcon size={16} className="text-white/60" />
                </div>
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1.5 overflow-y-auto mb-4 px-1">
              {navItems.map((item) => {
                const active = isActive(item.to);
                return (
                  <button
                    key={item.to}
                    onClick={() => navigateTo(item.to)}
                    className={`group relative flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 w-full text-left ${
                      active
                        ? "bg-white/20 text-white shadow-lg backdrop-blur-md border border-white/30"
                        : "text-white/80 hover:bg-white/10 hover:text-white"
                    }`}
                    aria-label={item.label}
                  >
                    {/* Active indicator */}
                    {active && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-r-full" />
                    )}
                    
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                        active 
                          ? 'bg-white/30 text-white' 
                          : 'bg-white/10 text-white/80 group-hover:bg-white/20 group-hover:text-white'
                      }`}>
                        {item.icon}
                      </div>
                      <span className={`text-sm font-medium truncate ${
                        active ? 'font-semibold' : ''
                      }`}>
                        {item.label}
                      </span>
                      {item.to.includes('/doctors') && pendingCount > 0 && (
                        <span className="ml-auto bg-gradient-to-r from-red-500 to-rose-600 text-white px-2.5 py-1 rounded-full text-xs font-bold shadow-lg ring-2 ring-red-400/30">
                          {pendingCount}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </nav>

            {/* Mobile Hospital Switcher */}
            <div className="border-t border-white/10 p-3 relative" ref={dropdownRef}>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowHospitalSwitcher((prev) => !prev);
                }}
                type="button"
                className="flex items-center gap-3 w-full hover:bg-white/10 rounded-xl px-3 py-2.5 transition-all duration-300 hover:shadow-lg group relative overflow-hidden"
                disabled={isSwitchingHospital}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <div className="w-10 h-10 bg-gradient-to-br from-blue-400 via-indigo-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg group-hover:shadow-xl group-hover:scale-105 transition-all duration-300 relative z-10 ring-2 ring-white/30">
                  <FaHospital className="text-white text-base drop-shadow-sm" />
                </div>
                <div className="flex-1 min-w-0 text-left relative z-10">
                  <div className="text-sm font-bold truncate text-white/95">
                    {currentHospital?.name || 'Hospital'}
                  </div>
                  <div className="text-xs text-white/60 font-medium mt-0.5">
                    {approvedHospitals.length} hospital{approvedHospitals.length !== 1 ? 's' : ''}
                  </div>
                </div>
                {approvedHospitals.length >= 1 && (
                  <ChevronDown
                    size={16}
                    className={`text-white/80 transition-all duration-300 flex-shrink-0 ml-auto relative z-10 ${
                      showHospitalSwitcher ? 'rotate-180 text-white' : 'group-hover:text-white'
                    }`}
                  />
                )}
              </button>

              {/* Mobile Hospital Dropdown */}
              {showHospitalSwitcher && approvedHospitals.length >= 1 && (
                <div className="mt-3 bg-white/95 backdrop-blur-xl rounded-2xl overflow-hidden border border-white/20 shadow-2xl">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 px-4 py-3 border-b border-white/10">
                    <div className="text-white font-bold text-sm flex items-center gap-2">
                      <FaHospital className="text-white/90" />
                      <span>Switch Hospital</span>
                    </div>
                    <div className="text-white/70 text-xs mt-0.5">
                      {approvedHospitals.length} available
                    </div>
                  </div>

                  {/* Hospital List */}
                  <div className="py-2 max-h-64 overflow-y-auto px-2">
                    {approvedHospitals.map((hospital) => {
                      const isActiveHospital = hospital.hospitalId === actualHospitalId;
                      return (
                        <button
                          key={hospital.hospitalId}
                          onClick={() => handleHospitalSwitch(hospital.hospitalId)}
                          disabled={isSwitchingHospital || isActiveHospital}
                          className={`w-full px-3 py-3 flex items-center gap-3 transition-all duration-200 text-left rounded-xl mb-1.5 group relative overflow-hidden ${
                            isActiveHospital
                              ? 'bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 shadow-md ring-2 ring-indigo-200'
                              : 'hover:bg-gradient-to-r hover:from-gray-50 hover:to-indigo-50 text-gray-700 hover:shadow-md hover:scale-[1.02]'
                          }`}
                        >
                          {/* Active indicator line */}
                          {isActiveHospital && (
                            <div className="absolute left-0 top-2 bottom-2 w-1 bg-gradient-to-b from-indigo-500 to-purple-600 rounded-r-full" />
                          )}
                          
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md transition-all duration-200 ${
                              isActiveHospital
                                ? 'bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600 shadow-lg scale-105'
                                : 'bg-gradient-to-br from-gray-300 to-gray-400 group-hover:from-indigo-400 group-hover:to-purple-500 group-hover:scale-105'
                            }`}
                          >
                            <FaHospital className="text-white text-sm" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-bold truncate ${isActiveHospital ? 'text-indigo-900' : 'text-gray-800'}`}>
                              {hospital.hospital.name}
                            </div>
                            <div className={`text-xs capitalize font-medium mt-0.5 ${
                              isActiveHospital ? 'text-indigo-600' : 'text-gray-500'
                            }`}>
                              {hospital.role}
                            </div>
                          </div>
                          {isActiveHospital && (
                            <div className="flex-shrink-0 w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center shadow-md">
                              <Check size={14} className="text-white font-bold" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Footer */}
                  <div className="border-t border-gray-100 bg-gradient-to-r from-gray-50 to-indigo-50 p-2 space-y-1.5">
                    <button
                      onClick={() => {
                        router.push('/select-hospital');
                        setShowHospitalSwitcher(false);
                      }}
                      className="w-full px-3 py-2.5 text-sm font-bold text-indigo-600 hover:text-indigo-700 hover:bg-white/80 rounded-xl transition-all duration-200 text-center flex items-center justify-center gap-2 group"
                    >
                      <span>View All Hospitals</span>
                      <span className="group-hover:translate-x-1 transition-transform duration-200">→</span>
                    </button>
                    <button
                      onClick={() => {
                        router.push('/request-access');
                        setShowHospitalSwitcher(false);
                      }}
                      className="w-full px-3 py-2.5 text-sm font-bold text-purple-600 hover:text-purple-700 hover:bg-white/80 rounded-xl transition-all duration-200 text-center flex items-center justify-center gap-2 group"
                    >
                      <Plus size={16} className="flex-shrink-0" />
                      <span>Select New Hospital</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Logout Button */}
            <div className="border-t border-white/10 pt-4 mt-4">
              <button
                onClick={() => logout()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm text-white hover:bg-red-500/20 hover:shadow-sm transition-all duration-200 font-semibold border border-white/20"
              >
                <LogOut size={18} />
                <span>Sign Out</span>
              </button>
            </div>
          </aside>
        </div>

        {/* Main Content */}
        <main 
          className="flex-1 min-h-screen md:mt-0 mt-16 transition-all duration-300"
          style={{ marginLeft: typeof window !== 'undefined' && window.innerWidth >= 768 ? (sidebarExpanded ? '280px' : '75px') : '0' }}
        >
          <div className="p-6 md:p-10 max-w-[1600px] mx-auto">
            <Suspense 
              key={pathname}
              fallback={
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
              }
            >
              <div key={pathname}>
                {children}
              </div>
            </Suspense>
          </div>
        </main>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes slide-down {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.4s ease-out;
        }
        .animate-slide-down {
          animation: slide-down 0.2s ease-out;
        }
      `}</style>
    </ProtectedRoute>
  );
}
