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
      bg: 'bg-gradient-to-br from-brand-violet-soft via-brand-violet-soft to-brand-violet-soft',
      spinnerColor: 'border-brand-violet',
    },
    doctor: {
      bg: 'bg-gradient-to-br from-status-open-soft via-status-open-soft to-status-open-soft',
      spinnerColor: 'border-status-open',
    },
    default: {
      bg: 'bg-gradient-to-br from-surface-canvas to-surface-canvas',
      spinnerColor: 'border-ink-700',
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
      <p className="text-ink-700 text-sm font-medium">{message}</p>
    </div>
  );
}
