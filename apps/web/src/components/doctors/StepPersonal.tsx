import { ChangeEvent } from "react";
import { CreateDoctorData, Doctor } from "@/types/doctorNew";
import { User } from "lucide-react";

interface StepProps {
  formData: Partial<Doctor>;
  handleInputChange: (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
  handleSelectChange?: (field: keyof CreateDoctorData, value: string | number) => void;
  genders?: string[];
  maritalStatuses?: string[];
  specializations?: string[];
  address?: string;
}

export function StepPersonal({
  formData,
  handleInputChange,
  handleSelectChange,
  genders = [],
  maritalStatuses = [],
}: StepProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold flex items-center gap-2">
        <User className="w-6 h-6 text-brand-violet" /> Personal Info
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium mb-1">Full Name *</label>
          <input
            name="name"
            value={formData.name || ""}
            onChange={handleInputChange}
            placeholder="Dr. John Smith"
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email *</label>
          <input
            name="email"
            value={formData.email || ""}
            onChange={handleInputChange}
            placeholder="doctor@example.com"
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Phone</label>
          <input
            name="phone"
            value={formData.phone || ""}
            onChange={handleInputChange}
            placeholder="+1 555 123 4567"
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Gender</label>
          <div className="flex gap-2">
            {genders.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => handleSelectChange?.("gender", g)}
                className={`px-3 py-1 rounded-lg border ${formData.gender === g ? "bg-brand-violet text-white" : "bg-surface-canvas"}`}>
                {g}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Marital Status
          </label>
          <div className="flex gap-2">
            {maritalStatuses.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleSelectChange?.("maritalStatus", s)}
                className={`px-3 py-1 rounded-lg border ${formData.maritalStatus === s ? "bg-brand-violet text-white" : "bg-surface-canvas"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
