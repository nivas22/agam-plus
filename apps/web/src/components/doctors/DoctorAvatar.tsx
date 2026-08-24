"use client";

import { paletteFor } from "@/lib/avatarPalette";

interface DoctorAvatarProps {
  name: string;
  size?: 'sm' | 'lg';
}

const SIZE_CLASSES: Record<'sm' | 'lg', string> = {
  sm: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
};

const getInitials = (name?: string) => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'D';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export default function DoctorAvatar({ name, size = 'sm' }: DoctorAvatarProps) {
  const [c1, c2] = paletteFor(name || 'Doctor');
  const initials = getInitials(name);

  return (
    <div
      className={`rounded-lg flex items-center justify-center text-white font-semibold shrink-0 shadow-sm ${SIZE_CLASSES[size]}`}
      style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
    >
      {initials}
    </div>
  );
}
