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

export default function DoctorAvatar({ name, size = 'sm' }: DoctorAvatarProps) {
  const [c1, c2] = paletteFor(name || 'Doctor');
  const initial = name?.trim()[0]?.toUpperCase() || 'D';

  return (
    <div
      className={`rounded-full flex items-center justify-center text-white font-semibold shrink-0 shadow-sm ${SIZE_CLASSES[size]}`}
      style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
    >
      {initial}
    </div>
  );
}
