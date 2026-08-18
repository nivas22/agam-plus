'use client';

interface MobileLoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'admin' | 'doctor' | 'default';
  fullScreen?: boolean;
}

export default function MobileLoadingSpinner({
  message = 'Loading...',
  size = 'md',
  variant = 'default',
  fullScreen = true,
}: MobileLoadingSpinnerProps) {
  // Size configurations
  const sizeClasses = {
    sm: 'w-6 h-6 border-2',
    md: 'w-10 h-10 border-[3px]',
    lg: 'w-16 h-16 border-4',
  };

  // Variant configurations for background and spinner color
  const variantConfig = {
    admin: {
      bg: 'bg-gradient-to-br from-blue-50 via-indigo-50 to-cyan-50',
      spinnerColor: 'border-indigo-600',
    },
    doctor: {
      bg: 'bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50',
      spinnerColor: 'border-emerald-600',
    },
    default: {
      bg: 'bg-gradient-to-br from-gray-50 to-gray-100',
      spinnerColor: 'border-gray-600',
    },
  };

  const config = variantConfig[variant];
  const containerClass = fullScreen
    ? `flex flex-col items-center justify-center min-h-screen ${config.bg}`
    : 'flex flex-col items-center justify-center py-20';

  return (
    <div className={containerClass}>
      <div
        className={`${sizeClasses[size]} border-solid ${config.spinnerColor} border-t-transparent rounded-full animate-spin mb-3`}
      />
      <p className="text-gray-600 text-sm font-medium">{message}</p>
    </div>
  );
}
