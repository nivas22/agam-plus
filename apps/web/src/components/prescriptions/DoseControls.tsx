// components/prescriptions/DoseControls.tsx
"use client";

import { PillGroup } from "@/components/common/EditFormControls";
import type { FoodTiming } from "@/types/medicine";
import type { HowOften } from "@/types/prescription";
import { DAYS_PRESET_OPTIONS, HOW_OFTEN_OPTIONS } from "@/types/prescription";

interface DoseControlsProps {
  howOften: HowOften;
  onHowOftenChange: (value: HowOften) => void;
  foodTiming: FoodTiming;
  onFoodTimingChange: (value: FoodTiming) => void;
  days: number;
  onDaysChange: (value: number) => void;
  disabled?: boolean;
}

// Shared by the prescription writer's medicine rows and the Medicine Packs
// admin drawer, so both author doses through the same How often / Food /
// Days controls instead of diverging UIs.
export default function DoseControls({
  howOften,
  onHowOftenChange,
  foodTiming,
  onFoodTimingChange,
  days,
  onDaysChange,
  disabled,
}: DoseControlsProps) {
  const isPresetDays = (DAYS_PRESET_OPTIONS as readonly number[]).includes(days);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div>
        <div className="text-[10.5px] uppercase tracking-wide text-ink-500 font-semibold mb-1.5">
          How often
        </div>
        <PillGroup
          options={HOW_OFTEN_OPTIONS.map((o) => o.label)}
          value={howOften}
          onChange={(value) => onHowOftenChange(value as HowOften)}
          disabled={disabled}
        />
      </div>
      <div>
        <div className="text-[10.5px] uppercase tracking-wide text-ink-500 font-semibold mb-1.5">
          Food
        </div>
        <PillGroup
          options={["Before", "After"]}
          value={foodTiming === "before_food" ? "Before" : "After"}
          onChange={(value) =>
            onFoodTimingChange(value === "Before" ? "before_food" : "after_food")
          }
          disabled={disabled}
        />
      </div>
      <div>
        <div className="text-[10.5px] uppercase tracking-wide text-ink-500 font-semibold mb-1.5">
          Days
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PillGroup
            options={DAYS_PRESET_OPTIONS.map(String)}
            value={isPresetDays ? String(days) : ""}
            onChange={(value) => onDaysChange(Number(value))}
            disabled={disabled}
          />
          <input
            type="number"
            min={1}
            disabled={disabled}
            value={isPresetDays ? "" : days}
            onChange={(e) => onDaysChange(Math.max(1, Number(e.target.value) || 1))}
            placeholder="Custom"
            className="w-20 px-2.5 py-1.5 rounded-lg border border-border bg-surface-paper text-sm disabled:opacity-50"
          />
        </div>
      </div>
    </div>
  );
}
