'use client';

import React from 'react';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}

export default function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg">
          {icon}
        </div>
        <div className="flex-1">
          <p className="text-sm text-gray-600 font-medium mb-1">{label}</p>
          <h2 className="text-3xl font-bold text-gray-900">{value}</h2>
        </div>
      </div>
    </div>
  );
}
