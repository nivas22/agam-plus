"use client";

import {
  ArrowLeft,
  Bell,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Settings,
  TrendingUp,
  User as UserIcon,
  Users,
  X,
} from "lucide-react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { FaHospital, FaUserMd } from "react-icons/fa";
import GlobalSearch from "@/components/GlobalSearch";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { apiUrl, fetchWithAuth } from "@/lib/api";

interface HospitalLayoutProps {
  children: React.ReactNode;
  hospitalId?: string;
}

export default function AdminHospitalLayout({
  children,
  hospitalId,
}: HospitalLayoutProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [showHospitalSwitcher, setShowHospitalSwitcher] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [profileMenuView, setProfileMenuView] = useState<"main" | "hospitals">(
    "main",
  );
  const [showNotifications, setShowNotifications] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const {
    user: userData,
    currentHospital,
    logout,
    navigateToHospitalRoute,
    approvedHospitals,
    switchHospital,
    isSwitchingHospital,
    getRoleBasedRedirect,
  } = useAuth();

  const actualHospitalId = hospitalId || (params.id as string);
  const displayName = userData?.name || userData?.email;

  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };
  const userInitials = getInitials(displayName);

  // Dynamic navigation items with actual hospital ID
  const navItems = [
    {
      to: "/dashboard",
      label: "Dashboard",
      icon: <LayoutDashboard size={18} />,
    },
    {
      to: "/doctors",
      label: "Doctors",
      icon: <FaUserMd size={18} />,
    },
    {
      to: "/patients",
      label: "Patients",
      icon: <Users size={18} />,
    },
    {
      to: "/appointments",
      label: "Appointments",
      icon: <Calendar size={18} />,
    },
    {
      to: "/payments",
      label: "Payments",
      icon: <IndianRupee size={18} />,
      isNew: true,
    },
    {
      to: "/attendance",
      label: "Attendance",
      icon: <ClipboardList size={18} />,
    },
  ];

  // Desktop sidebar groups
  const careItems = navItems.slice(0, 4);
  const operationsItems = navItems.slice(4);
  const comingSoonItems = [
    { label: "Reports", icon: <TrendingUp size={18} /> },
    { label: "Settings", icon: <Settings size={18} /> },
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
      console.error("Failed to switch hospital:", error);
    }
  };

  const closeProfileMenu = () => {
    setShowProfileMenu(false);
    setProfileMenuView("main");
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
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showHospitalSwitcher]);

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setShowProfileMenu(false);
      }
    };

    if (showProfileMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showProfileMenu]);

  // Close notifications when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(target)
      ) {
        setShowNotifications(false);
      }
    };

    if (showNotifications) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showNotifications]);

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
          apiUrl(`/hospitals/${actualHospitalId}/pending-count`),
        );
        if (response.ok) {
          const data = await response.json();
          setPendingCount(data.count);
        }
      } catch (error) {
        console.error("Failed to fetch pending count:", error);
      }
    };

    if (actualHospitalId) {
      fetchPendingCount();
    }
  }, [actualHospitalId]);

  const currentSection = navItems.find((item) => isActive(item.to));

  return (
    <ProtectedRoute requiredRole="admin">
      <div className="flex min-h-screen bg-surface-canvas">
        {/* Desktop Sidebar */}
        <aside
          className="hidden md:flex md:flex-col md:flex-shrink-0 bg-night-bg text-white sticky top-0 self-start h-screen transition-all duration-300 ease-in-out shadow-2xl border-r border-night-border z-50"
          style={{ width: sidebarExpanded ? "240px" : "72px" }}
        >
          {/* Logo/Brand Section */}
          <div className="p-4 border-b border-night-border">
            <button
              onClick={() => setSidebarExpanded(!sidebarExpanded)}
              className={`flex items-center gap-3 w-full ${sidebarExpanded ? "" : "justify-center"}`}
              aria-label={
                sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"
              }
            >
              <div className="w-9 h-9 bg-status-open hover:bg-status-open-hover rounded-lg flex items-center justify-center flex-shrink-0 shadow-md transition-colors">
                <Plus className="text-white" size={18} />
              </div>
              {sidebarExpanded && (
                <div className="flex-1 min-w-0 text-left">
                  <h1 className="text-base font-bold text-white truncate">
                    Agam Plus
                  </h1>
                  <p className="text-[10px] text-night-muted font-medium tracking-wider uppercase truncate">
                    {currentHospital?.name || "Clinic"}
                  </p>
                </div>
              )}
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-4">
            <div className="space-y-1">
              {sidebarExpanded && (
                <div className="px-3 pb-1 text-[10px] font-semibold text-night-muted uppercase tracking-wider">
                  Care
                </div>
              )}
              {careItems.map((item) => {
                const active = isActive(item.to);
                return (
                  <button
                    key={item.to}
                    onClick={() => navigateTo(item.to)}
                    className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 w-full text-left border-l-2 ${
                      active
                        ? "bg-night-active text-white border-status-open"
                        : "text-night-muted hover:bg-night-hover hover:text-white border-transparent"
                    }`}
                    title={!sidebarExpanded ? item.label : undefined}
                    aria-label={item.label}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                        {item.icon}
                      </div>
                      {sidebarExpanded && (
                        <span
                          className={`text-sm truncate ${active ? "font-semibold" : "font-medium"}`}
                        >
                          {item.label}
                        </span>
                      )}
                      {item.to.includes("/doctors") &&
                        pendingCount > 0 &&
                        sidebarExpanded && (
                          <span className="ml-auto bg-status-warning text-white px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0">
                            {pendingCount}
                          </span>
                        )}
                      {item.to.includes("/doctors") &&
                        pendingCount > 0 &&
                        !sidebarExpanded && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-status-warning rounded-full flex items-center justify-center text-white text-[9px] font-bold">
                            {pendingCount}
                          </div>
                        )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="space-y-1">
              {sidebarExpanded && (
                <div className="px-3 pb-1 text-[10px] font-semibold text-night-muted uppercase tracking-wider">
                  Operations
                </div>
              )}
              {operationsItems.map((item) => {
                const active = isActive(item.to);
                return (
                  <button
                    key={item.to}
                    onClick={() => navigateTo(item.to)}
                    className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 w-full text-left border-l-2 ${
                      active
                        ? "bg-night-active text-white border-status-open"
                        : "text-night-muted hover:bg-night-hover hover:text-white border-transparent"
                    }`}
                    title={!sidebarExpanded ? item.label : undefined}
                    aria-label={item.label}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                        {item.icon}
                      </div>
                      {sidebarExpanded && (
                        <span
                          className={`text-sm truncate ${active ? "font-semibold" : "font-medium"}`}
                        >
                          {item.label}
                        </span>
                      )}
                      {item.isNew && sidebarExpanded && (
                        <span className="ml-auto bg-white text-brand-violet px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide flex-shrink-0">
                          New
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
              {comingSoonItems.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-night-muted/50 cursor-not-allowed border-l-2 border-transparent"
                  title={sidebarExpanded ? undefined : item.label}
                  aria-disabled="true"
                >
                  <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                    {item.icon}
                  </div>
                  {sidebarExpanded && (
                    <span className="text-sm font-medium truncate">
                      {item.label}
                    </span>
                  )}
                  {sidebarExpanded && (
                    <span className="ml-auto text-[9px] font-semibold uppercase tracking-wide text-night-muted/60">
                      Soon
                    </span>
                  )}
                </div>
              ))}
            </div>
          </nav>

          {/* System status footer */}
          <div className="border-t border-night-border p-4">
            <div
              className={`flex items-center gap-2 ${sidebarExpanded ? "" : "justify-center"}`}
            >
              <span className="w-2 h-2 rounded-full bg-status-open flex-shrink-0" />
              {sidebarExpanded && (
                <div className="min-w-0">
                  <div className="text-xs font-medium text-white truncate">
                    All systems normal
                  </div>
                  <div className="text-[10px] text-night-muted truncate">
                    Synced 2 min ago
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Mobile Navbar */}
        <div className="md:hidden fixed top-0 left-0 right-0 bg-gradient-to-r from-brand-violet via-brand-violet to-brand-violet text-white flex items-center justify-between px-4 py-4 shadow-2xl z-50 backdrop-blur-lg border-b border-white/10">
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
                Agam Plus - {currentHospital?.name || "Hospital"}
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
            className={`absolute top-0 left-0 w-80 h-full bg-gradient-to-br from-brand-violet via-brand-violet to-brand-violet text-white shadow-2xl p-6 transform transition-transform duration-300 flex flex-col border-r border-white/10 ${
              isOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            {/* Header */}
            <div className="mt-20 mb-6">
              <button
                onClick={() => {
                  navigateTo("/profile");
                  toggleMenu();
                }}
                className="w-full bg-white/10 backdrop-blur-md rounded-xl p-4 shadow-lg border border-white/20 hover:bg-white/15 transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center shadow-md">
                    <FaHospital className="text-white text-lg" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <h2 className="text-base font-bold text-white">
                      Agam Plus
                    </h2>
                    <p className="text-sm text-white/80 truncate">
                      Admin - {displayName}
                    </p>
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
                      <div
                        className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                          active
                            ? "bg-white/30 text-white"
                            : "bg-white/10 text-white/80 group-hover:bg-white/20 group-hover:text-white"
                        }`}
                      >
                        {item.icon}
                      </div>
                      <span
                        className={`text-sm font-medium truncate ${
                          active ? "font-semibold" : ""
                        }`}
                      >
                        {item.label}
                      </span>
                      {item.to.includes("/doctors") && pendingCount > 0 && (
                        <span className="ml-auto bg-gradient-to-r from-status-danger to-status-danger text-white px-2.5 py-1 rounded-full text-xs font-bold shadow-lg ring-2 ring-status-danger/30">
                          {pendingCount}
                        </span>
                      )}
                      {item.isNew && (
                        <span className="ml-auto bg-white text-brand-violet px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide flex-shrink-0">
                          New
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </nav>

            {/* Mobile Hospital Switcher */}
            <div
              className="border-t border-white/10 p-3 relative"
              ref={dropdownRef}
            >
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

                <div className="w-10 h-10 bg-gradient-to-br from-brand-violet via-brand-violet to-brand-violet rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg group-hover:shadow-xl group-hover:scale-105 transition-all duration-300 relative z-10 ring-2 ring-white/30">
                  <FaHospital className="text-white text-base drop-shadow-sm" />
                </div>
                <div className="flex-1 min-w-0 text-left relative z-10">
                  <div className="text-sm font-bold truncate text-white/95">
                    {currentHospital?.name || "Hospital"}
                  </div>
                  <div className="text-xs text-white/60 font-medium mt-0.5">
                    {approvedHospitals.length} hospital
                    {approvedHospitals.length !== 1 ? "s" : ""}
                  </div>
                </div>
                {approvedHospitals.length >= 1 && (
                  <ChevronDown
                    size={16}
                    className={`text-white/80 transition-all duration-300 flex-shrink-0 ml-auto relative z-10 ${
                      showHospitalSwitcher
                        ? "rotate-180 text-white"
                        : "group-hover:text-white"
                    }`}
                  />
                )}
              </button>

              {/* Mobile Hospital Dropdown */}
              {showHospitalSwitcher && approvedHospitals.length >= 1 && (
                <div className="mt-3 bg-surface-paper/95 backdrop-blur-xl rounded-2xl overflow-hidden border border-white/20 shadow-2xl">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-brand-violet via-brand-violet to-brand-violet px-4 py-3 border-b border-white/10">
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
                      const isActiveHospital =
                        hospital.hospitalId === actualHospitalId;
                      return (
                        <button
                          key={hospital.hospitalId}
                          onClick={() =>
                            handleHospitalSwitch(hospital.hospitalId)
                          }
                          disabled={isSwitchingHospital || isActiveHospital}
                          className={`w-full px-3 py-3 flex items-center gap-3 transition-all duration-200 text-left rounded-xl mb-1.5 group relative overflow-hidden ${
                            isActiveHospital
                              ? "bg-gradient-to-r from-brand-violet-soft to-brand-violet-soft text-brand-violet shadow-md ring-2 ring-brand-violet/20"
                              : "hover:bg-gradient-to-r hover:from-surface-canvas hover:to-brand-violet-soft text-ink-700 hover:shadow-md hover:scale-[1.02]"
                          }`}
                        >
                          {/* Active indicator line */}
                          {isActiveHospital && (
                            <div className="absolute left-0 top-2 bottom-2 w-1 bg-gradient-to-b from-brand-violet to-brand-violet rounded-r-full" />
                          )}

                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md transition-all duration-200 ${
                              isActiveHospital
                                ? "bg-gradient-to-br from-brand-violet via-brand-violet to-brand-violet shadow-lg scale-105"
                                : "bg-gradient-to-br from-ink-500 to-ink-500 group-hover:from-brand-violet group-hover:to-brand-violet group-hover:scale-105"
                            }`}
                          >
                            <FaHospital className="text-white text-sm" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div
                              className={`text-sm font-bold truncate ${isActiveHospital ? "text-brand-violet" : "text-ink-900"}`}
                            >
                              {hospital.hospital.name}
                            </div>
                            <div
                              className={`text-xs capitalize font-medium mt-0.5 ${
                                isActiveHospital
                                  ? "text-brand-violet"
                                  : "text-ink-500"
                              }`}
                            >
                              {hospital.role}
                            </div>
                          </div>
                          {isActiveHospital && (
                            <div className="flex-shrink-0 w-6 h-6 bg-brand-violet rounded-full flex items-center justify-center shadow-md">
                              <Check
                                size={14}
                                className="text-white font-bold"
                              />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Footer */}
                  <div className="border-t border-border bg-gradient-to-r from-surface-canvas to-brand-violet-soft p-2 space-y-1.5">
                    <button
                      onClick={() => {
                        router.push("/select-hospital");
                        setShowHospitalSwitcher(false);
                      }}
                      className="w-full px-3 py-2.5 text-sm font-bold text-brand-violet hover:text-brand-violet-hover hover:bg-surface-paper/80 rounded-xl transition-all duration-200 text-center flex items-center justify-center gap-2 group"
                    >
                      <span>View All Hospitals</span>
                      <span className="group-hover:translate-x-1 transition-transform duration-200">
                        →
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        router.push("/request-access");
                        setShowHospitalSwitcher(false);
                      }}
                      className="w-full px-3 py-2.5 text-sm font-bold text-brand-violet hover:text-brand-violet-hover hover:bg-surface-paper/80 rounded-xl transition-all duration-200 text-center flex items-center justify-center gap-2 group"
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
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm text-white hover:bg-status-danger/20 hover:shadow-sm transition-all duration-200 font-semibold border border-white/20"
              >
                <LogOut size={18} />
                <span>Sign Out</span>
              </button>
            </div>
          </aside>
        </div>

        {/* Main Content */}
        <main className="flex-1 min-w-0 min-h-screen mt-16 md:mt-0 transition-all duration-300">
          {/* Desktop Top Bar */}
          <header className="hidden md:flex items-center justify-between gap-4 px-6 py-3 bg-surface-paper border-b border-border sticky top-0 z-30">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-sm min-w-0">
              <span className="text-ink-500 truncate">Agam Plus</span>
              <span className="text-ink-500">/</span>
              <span className="text-ink-500 truncate">Staff</span>
              <span className="text-ink-500">/</span>
              <span className="text-ink-900 font-semibold truncate">
                {currentSection ? currentSection.label : "Dashboard"}
              </span>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              {/* Search */}
              <GlobalSearch hospitalId={actualHospitalId} />

              {/* Notifications */}
              <div className="relative" ref={notificationsRef}>
                <button
                  onClick={() => setShowNotifications((prev) => !prev)}
                  className="p-2 rounded-lg text-ink-700 hover:bg-surface-canvas transition-colors"
                  aria-label="Notifications"
                >
                  <Bell size={18} />
                </button>
                {showNotifications && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-surface-paper rounded-xl shadow-2xl border border-border overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-border text-sm font-semibold text-ink-900">
                      Notifications
                    </div>
                    <div className="px-4 py-6 text-sm text-ink-500 text-center">
                      No new notifications
                    </div>
                  </div>
                )}
              </div>

              {/* Profile trigger */}
              <div className="relative" ref={profileMenuRef}>
                <button
                  onClick={() => {
                    setShowProfileMenu((prev) => !prev);
                    setProfileMenuView("main");
                  }}
                  className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-lg hover:bg-surface-canvas transition-colors flex-shrink-0"
                  aria-label="Profile menu"
                >
                  <div className="w-9 h-9 rounded-full bg-brand-violet-soft flex items-center justify-center text-brand-violet flex-shrink-0">
                    <span className="text-sm font-semibold">
                      {userInitials}
                    </span>
                  </div>
                  <div className="hidden xl:block text-left min-w-0">
                    <div className="text-sm font-semibold text-ink-900 truncate max-w-[140px]">
                      {displayName}
                    </div>
                    <div className="text-xs text-ink-500 truncate">
                      Practice admin
                    </div>
                  </div>
                  <ChevronDown
                    size={16}
                    className="text-ink-500 flex-shrink-0"
                  />
                </button>

                {showProfileMenu && profileMenuView === "main" && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-surface-paper rounded-xl shadow-2xl border border-border overflow-hidden z-50">
                    {/* Current User */}
                    <button
                      onClick={() => {
                        closeProfileMenu();
                        navigateToHospitalRoute("/profile");
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 border-b border-border hover:bg-surface-canvas transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-brand-violet-soft flex items-center justify-center text-brand-violet flex-shrink-0">
                        <span className="text-sm font-semibold">
                          {userInitials}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-ink-900 truncate">
                          {displayName}
                        </div>
                        <div className="text-xs text-ink-500 truncate">
                          {currentHospital?.name || "Hospital"}
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        closeProfileMenu();
                        navigateToHospitalRoute("/profile");
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-surface-canvas transition-colors text-left"
                    >
                      <UserIcon size={16} />
                      <span>Profile</span>
                    </button>

                    {approvedHospitals.length >= 1 && (
                      <button
                        onClick={() => setProfileMenuView("hospitals")}
                        className="w-full flex items-center justify-between gap-2.5 px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-surface-canvas transition-colors text-left border-t border-border"
                      >
                        <span className="flex items-center gap-2.5">
                          <FaHospital size={14} />
                          <span>Switch Hospital</span>
                        </span>
                        <ChevronRight
                          size={16}
                          className="text-ink-500 flex-shrink-0"
                        />
                      </button>
                    )}

                    <button
                      onClick={() => {
                        closeProfileMenu();
                        logout();
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-status-danger hover:bg-status-danger-soft transition-colors text-left border-t border-border"
                    >
                      <LogOut size={16} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}

                {showProfileMenu && profileMenuView === "hospitals" && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-surface-paper rounded-xl shadow-2xl border border-border overflow-hidden z-50">
                    {/* Header with back button */}
                    <div className="flex items-center gap-2 px-3 py-3 border-b border-border">
                      <button
                        onClick={() => setProfileMenuView("main")}
                        aria-label="Back"
                        className="p-1.5 -ml-1 rounded-lg hover:bg-surface-canvas text-ink-700 transition-colors"
                      >
                        <ArrowLeft size={18} />
                      </button>
                      <span className="text-sm font-semibold text-ink-900">
                        Switch Hospital
                      </span>
                    </div>

                    {/* Selected Hospital */}
                    {(() => {
                      const current = approvedHospitals.find(
                        (h) => h.hospitalId === actualHospitalId,
                      );
                      if (!current) return null;
                      return (
                        <div className="px-2 pt-2">
                          <div className="px-2.5 pb-1.5 text-xs font-semibold text-ink-500 uppercase tracking-wide">
                            Selected Hospital
                          </div>
                          <div className="w-full px-2.5 py-2 flex items-center gap-2.5 rounded-lg bg-brand-violet-soft text-brand-violet">
                            <div className="w-8 h-8 rounded-lg bg-brand-violet flex items-center justify-center flex-shrink-0">
                              <FaHospital className="text-white text-xs" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">
                                {current.hospital.name}
                              </div>
                              <div className="text-xs text-ink-500 capitalize truncate">
                                {current.role}
                              </div>
                            </div>
                            <Check
                              size={14}
                              className="text-brand-violet flex-shrink-0"
                            />
                          </div>
                        </div>
                      );
                    })()}

                    {/* Other Hospitals */}
                    {approvedHospitals.filter(
                      (h) => h.hospitalId !== actualHospitalId,
                    ).length > 0 && (
                      <div className="px-2 pt-2">
                        <div className="px-2.5 pb-1.5 text-xs font-semibold text-ink-500 uppercase tracking-wide">
                          Other Hospitals
                        </div>
                        <div className="max-h-44 overflow-y-auto space-y-1">
                          {approvedHospitals
                            .filter((h) => h.hospitalId !== actualHospitalId)
                            .map((hospital) => (
                              <button
                                key={hospital.hospitalId}
                                onClick={() => {
                                  handleHospitalSwitch(hospital.hospitalId);
                                  closeProfileMenu();
                                }}
                                disabled={isSwitchingHospital}
                                className="w-full px-2.5 py-2 flex items-center gap-2.5 rounded-lg text-left hover:bg-surface-canvas text-ink-700 transition-colors"
                              >
                                <div className="w-8 h-8 rounded-lg bg-ink-500 flex items-center justify-center flex-shrink-0">
                                  <FaHospital className="text-white text-xs" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium truncate">
                                    {hospital.hospital.name}
                                  </div>
                                  <div className="text-xs text-ink-500 capitalize truncate">
                                    {hospital.role}
                                  </div>
                                </div>
                              </button>
                            ))}
                        </div>
                      </div>
                    )}

                    <div className="p-2 pt-2 border-t border-border mt-2">
                      <button
                        onClick={() => {
                          closeProfileMenu();
                          router.push("/select-hospital");
                        }}
                        className="w-full px-2.5 py-2 text-sm font-medium text-brand-violet hover:bg-brand-violet-soft rounded-lg transition-colors text-left flex items-center gap-2"
                      >
                        <Plus size={14} className="flex-shrink-0" />
                        <span>Select Hospital</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          <div className="p-4 md:p-4 max-w-[1600px] mx-auto">
            <Suspense
              key={pathname}
              fallback={
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-violet"></div>
                </div>
              }
            >
              <div key={pathname}>{children}</div>
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
