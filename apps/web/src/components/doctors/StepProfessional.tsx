import { ChangeEvent } from "react";
import { GraduationCap } from "lucide-react";
import { CreateDoctorData } from "@/types/doctorNew";

interface StepProps {
  formData: Partial<CreateDoctorData>;
  handleInputChange: (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
  handleSelectChange?: (field: keyof CreateDoctorData, value: string | number) => void;
  genders?: string[];
  maritalStatuses?: string[];
  specializations?: string[];
}

export function StepProfessional({
  formData,
  handleInputChange,
  specializations = [],
}: StepProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold flex items-center gap-2">
        <GraduationCap className="w-6 h-6 text-status-open" /> Professional Info
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium mb-1">
            Specialization *
          </label>
          <select
            name="specialization"
            value={formData.specialization || ""}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border rounded-lg">
            <option value="">Select Specialization</option>
            {specializations.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Years of Experience
          </label>
          <input
            type="number"
            name="experience"
            value={formData.experience || ""}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Address</label>
          <input
            name="address"
            value={formData.address || ""}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
      </div>
    </div>
  );
}