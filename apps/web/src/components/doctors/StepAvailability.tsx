import { Clock, Plus, Trash2, Calendar, Watch, CheckCircle, XCircle } from "lucide-react";
import { CreateDoctorData } from "@/types/doctorNew";
import { TimeSlot } from "@/types/appointment";

interface StepAvailabilityProps {
  formData: Partial<CreateDoctorData>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<CreateDoctorData>>>;
  daysOfWeek: string[];
  durationOptions: number[];
  activeDay: string;
  setActiveDay: (day: string) => void;
  newTimeSlot: TimeSlot;
  setNewTimeSlot: (slot: TimeSlot) => void;
  addTimeSlot: () => void;
  removeTimeSlot: (day: string, index: number) => void;
  timeOptions: string[];
}

export function StepAvailability({
  formData,
  daysOfWeek,
  durationOptions,
  activeDay,
  setActiveDay,
  newTimeSlot,
  setNewTimeSlot,
  addTimeSlot,
  removeTimeSlot,
  timeOptions,
  setFormData,
}: StepAvailabilityProps) {
  
  const formatTimeForDisplay = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${period}`;
  };

  const getActiveDayAvailability = () => {
    return formData.availability?.filter(slot => slot.day === activeDay) || [];
  };

  const isTimeSlotValid = () => {
    if (!newTimeSlot.startTime || !newTimeSlot.endTime) return false;
    
    // Check if start time is before end time
    if (newTimeSlot.startTime >= newTimeSlot.endTime) return false;
    
    // Check for overlaps with existing slots
    const activeDaySlots = getActiveDayAvailability();
    
    // If no existing slots, it's valid
    if (activeDaySlots.length === 0) return true;
    
    const newStart = newTimeSlot.startTime;
    const newEnd = newTimeSlot.endTime;
    
    // Check if new slot overlaps with any existing slot
    const hasOverlap = activeDaySlots.some(slot => {
      const slotStart = slot.startTime;
      const slotEnd = slot.endTime;
      
      // Overlap occurs if:
      // newStart is between slotStart and slotEnd OR
      // newEnd is between slotStart and slotEnd OR
      // new slot completely contains existing slot OR
      // existing slot completely contains new slot
      return (
        (newStart >= slotStart && newStart < slotEnd) ||
        (newEnd > slotStart && newEnd <= slotEnd) ||
        (newStart <= slotStart && newEnd >= slotEnd) ||
        (newStart >= slotStart && newEnd <= slotEnd)
      );
    });
    
    return !hasOverlap;
  };

  const getFullDayName = (day: string) => {
    const dayMap: Record<string, string> = {
      'mon': 'Monday',
      'tue': 'Tuesday',
      'wed': 'Wednesday',
      'thu': 'Thursday',
      'fri': 'Friday',
      'sat': 'Saturday',
      'sun': 'Sunday'
    };
    return dayMap[day] || day;
  };

  const clearTimeSlot = () => {
    setNewTimeSlot({ day: activeDay, startTime: '', endTime: '' });
  };

  const handleAddTimeSlot = () => {
    if (!isTimeSlotValid()) return;
    
    addTimeSlot();
    // Clear the form after adding
    setNewTimeSlot({ day: activeDay, startTime: '', endTime: '' });
  };

  // Get available time options excluding already allotted times
  const getAvailableTimeOptions = (type: 'start' | 'end') => {
    const activeDaySlots = getActiveDayAvailability();
    
    if (activeDaySlots.length === 0) {
      return timeOptions;
    }

    // For start time, we need to consider all busy periods
    if (type === 'start') {
      return timeOptions.filter(time => {
        // Check if this time falls within any existing slot
        const isInExistingSlot = activeDaySlots.some(slot => 
          time >= slot.startTime && time < slot.endTime
        );
        return !isInExistingSlot;
      });
    } else {
      // For end time, we need to be more careful about the currently selected start time
      if (!newTimeSlot.startTime) {
        return timeOptions;
      }
      
      return timeOptions.filter(time => {
        // End time must be after start time
        if (time <= newTimeSlot.startTime!) return false;
        
        // Check if this end time would overlap with existing slots
        const wouldOverlap = activeDaySlots.some(slot => {
          // Check if the new slot (startTime to time) overlaps with existing slot
          return (
            (newTimeSlot.startTime! < slot.endTime && time > slot.startTime)
          );
        });
        
        return !wouldOverlap;
      });
    }
  };

  const activeDaySlots = getActiveDayAvailability();
  const isValidSlot = isTimeSlotValid();
  const availableStartTimes = getAvailableTimeOptions('start');
  const availableEndTimes = getAvailableTimeOptions('end');

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="text-center mb-4 md:mb-6">
        <h3 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center justify-center gap-2">
          <Clock className="w-5 h-5 md:w-7 md:h-7 text-blue-600" /> 
          Set Your Availability
        </h3>
        <p className="text-sm md:text-base text-gray-600 mt-1 md:mt-2">Configure your appointment schedule - Add multiple time slots per day</p>
      </div>

      {/* Appointment Duration Section */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 md:p-6 rounded-lg md:rounded-xl border border-blue-100">
        <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
          <Watch className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
          <h4 className="font-semibold text-base md:text-lg text-gray-800">Appointment Duration</h4>
        </div>
        <p className="text-xs md:text-sm text-gray-600 mb-3 md:mb-4">Select appointment length</p>
        <div className="flex flex-wrap gap-2">
          {durationOptions.map((d: number) => (
            <button
              key={d}
              className={`px-3 py-2 md:px-4 md:py-2 text-sm rounded-lg border transition-all duration-200 ${
                formData.appointmentDuration === d 
                  ? "bg-blue-500 text-white border-blue-500 shadow-lg" 
                  : "bg-white text-gray-700 border-gray-200 hover:border-blue-300"
              }`}
              onClick={() => setFormData((prev) => ({ ...prev, appointmentDuration: d }))}
            >
              {d} min
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
        {/* Day Selection Panel */}
        <div className="bg-gradient-to-br from-gray-50 to-white p-4 md:p-6 rounded-lg md:rounded-xl border border-gray-200 lg:col-span-1">
          <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
            <Calendar className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
            <h5 className="font-semibold text-base md:text-lg text-gray-800">Select Days</h5>
          </div>
          <p className="text-xs md:text-sm text-gray-600 mb-3 md:mb-4">Choose available days</p>
          <div className="grid grid-cols-3 gap-2">
            {daysOfWeek.map((day) => {
              const daySlots = formData.availability?.filter((s: any) => s.day === day) || [];
              const hasAvailability = daySlots.length > 0;
              return (
                <button
                  key={day}
                  onClick={() => {
                    setActiveDay(day);
                    setNewTimeSlot({ day, startTime: '', endTime: '' });
                  }}
                  className={`p-2 md:p-3 rounded-lg border-2 transition-all duration-200 flex flex-col items-center justify-center ${
                    activeDay === day 
                      ? "bg-blue-500 text-white border-blue-500 shadow-lg" 
                      : hasAvailability 
                        ? "bg-green-50 text-green-700 border-green-300 shadow-sm" 
                        : "bg-white text-gray-700 border-gray-200 hover:border-blue-300"
                  }`}
                >
                  <span className="font-semibold text-xs md:text-sm">{day.substring(0, 3)}</span>
                  {hasAvailability && (
                    <div className="flex items-center gap-1 mt-1">
                      <CheckCircle className="w-3 h-3 md:w-4 md:h-4 text-green-600" />
                      <span className="text-xs font-medium">{daySlots.length}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Time Selection Panel */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 md:p-6 rounded-lg md:rounded-xl border border-blue-200 lg:col-span-1">
          <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
            <Clock className="w-4 h-4 md:w-5 md:h-5 text-orange-600" />
            <h5 className="font-semibold text-base md:text-lg text-gray-800">
              Time Slots for <span className="text-blue-600 capitalize">{getFullDayName(activeDay)}</span>
            </h5>
          </div>

          <div className="space-y-3 md:space-y-4">
            {/* Current Slots Display */}
            {activeDaySlots.length > 0 && (
              <div className="bg-white p-3 md:p-4 rounded-lg border border-blue-200">
                <div className="text-xs md:text-sm font-medium text-gray-700 mb-2">
                  Current Slots ({activeDaySlots.length}):
                </div>
                <div className="space-y-2">
                  {activeDaySlots.map((slot, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-xs md:text-sm font-medium text-gray-800">
                          {formatTimeForDisplay(slot.startTime)} - {formatTimeForDisplay(slot.endTime)}
                        </span>
                      </div>
                      <button
                        onClick={() => removeTimeSlot(activeDay, index)}
                        className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                        title="Remove time slot"
                      >
                        <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add New Slot */}
            <div className="bg-white p-3 md:p-4 rounded-lg border border-blue-200">
              <div className="text-xs md:text-sm font-medium text-gray-700 mb-3">Add New Time Slot:</div>
              
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div className="space-y-1 md:space-y-2">
                  <label className="block text-xs md:text-sm font-medium text-gray-700">Start Time</label>
                  <select
                    value={newTimeSlot.startTime}
                    onChange={(e) => setNewTimeSlot({ ...newTimeSlot, startTime: e.target.value, endTime: '' })}
                    className="w-full p-2 md:p-3 text-sm border border-gray-300 rounded-lg bg-white focus:ring-1 md:focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select start time</option>
                    {availableStartTimes.map((t) => (
                      <option key={t} value={t}>{formatTimeForDisplay(t)}</option>
                    ))}
                  </select>
                  {availableStartTimes.length === 0 && (
                    <p className="text-xs text-red-500 mt-1">No available start times (all times are booked)</p>
                  )}
                </div>
                <div className="space-y-1 md:space-y-2">
                  <label className="block text-xs md:text-sm font-medium text-gray-700">End Time</label>
                  <select
                    value={newTimeSlot.endTime}
                    onChange={(e) => setNewTimeSlot({ ...newTimeSlot, endTime: e.target.value })}
                    disabled={!newTimeSlot.startTime}
                    className="w-full p-2 md:p-3 text-sm border border-gray-300 rounded-lg bg-white focus:ring-1 md:focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">Select end time</option>
                    {availableEndTimes.map((t) => (
                      <option key={t} value={t}>{formatTimeForDisplay(t)}</option>
                    ))}
                  </select>
                  {newTimeSlot.startTime && availableEndTimes.length === 0 && (
                    <p className="text-xs text-red-500 mt-1">No available end times for selected start time</p>
                  )}
                </div>
              </div>

              {/* Validation Messages */}
              {newTimeSlot.startTime && newTimeSlot.endTime && !isValidSlot && (
                <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-600 text-xs md:text-sm">
                    <XCircle className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0" />
                    <div>
                      {newTimeSlot.startTime >= newTimeSlot.endTime ? (
                        <span>End time must be after start time</span>
                      ) : (
                        <span>This time slot overlaps with existing slots</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 md:gap-3 mt-4">
                <button
                  onClick={handleAddTimeSlot}
                  disabled={!isValidSlot}
                  className={`flex items-center justify-center gap-1 md:gap-2 flex-1 px-3 py-2 md:px-4 md:py-3 text-sm rounded-lg transition-all duration-200 ${
                    isValidSlot 
                      ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md" 
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  <Plus className="w-3 h-3 md:w-4 md:h-4" />
                  <span>Add Time Slot</span>
                </button>
                
                <button
                  onClick={clearTimeSlot}
                  disabled={!newTimeSlot.startTime && !newTimeSlot.endTime}
                  className="flex items-center justify-center px-3 py-2 md:px-4 md:py-3 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors text-sm disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Help Text */}
            <div className="text-xs text-gray-500 bg-white p-3 rounded-lg border border-gray-200">
              <p>💡 <strong>Tip:</strong> You can add multiple time slots per day. For example:</p>
              <ul className="mt-1 space-y-1">
                <li>• Morning: 9:00 AM - 12:00 PM</li>
                <li>• Afternoon: 2:00 PM - 5:00 PM</li>
                <li>• Evening: 6:00 PM - 8:00 PM</li>
              </ul>
              <p className="mt-2 text-green-600 font-medium">Available times are automatically filtered to prevent overlaps!</p>
            </div>
          </div>
        </div>

        {/* Preview Panel */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 md:p-6 rounded-lg md:rounded-xl border border-green-200 lg:col-span-1 lg:col-start-1 xl:col-start-3">
          <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
            <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
            <h5 className="font-semibold text-base md:text-lg text-gray-800">Availability Preview</h5>
          </div>

          <div className="space-y-3 md:space-y-4">
            {/* Active Day Summary */}
            <div className="text-center p-3 md:p-4 bg-white rounded-lg border border-green-200">
              <div className="text-lg md:text-xl font-bold text-green-600 capitalize">
                {getFullDayName(activeDay)}
              </div>
              <div className="text-xs md:text-sm text-gray-500">
                {activeDaySlots.length} time slot{activeDaySlots.length !== 1 ? 's' : ''} configured
              </div>
            </div>

            {/* Time Slots Preview */}
            {activeDaySlots.length > 0 ? (
              <div className="space-y-2 md:space-y-3">
                <div className="text-xs md:text-sm font-medium text-gray-700">Time Slots:</div>
                {activeDaySlots.map((slot, index) => (
                  <div key={index} className="bg-white p-3 rounded-lg border border-green-200 shadow-sm">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${
                          index === 0 ? 'bg-green-400' : 
                          index === 1 ? 'bg-blue-400' : 
                          index === 2 ? 'bg-orange-400' : 'bg-purple-400'
                        }`}></div>
                        <span className="font-medium text-sm text-gray-800">
                          {formatTimeForDisplay(slot.startTime)} - {formatTimeForDisplay(slot.endTime)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        Slot {index + 1}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 md:py-8 bg-white rounded-lg border border-dashed border-gray-300">
                <Clock className="w-8 h-8 md:w-12 md:h-12 text-gray-300 mx-auto mb-2" />
                <div className="text-sm text-gray-500 font-medium">No time slots added</div>
                <div className="text-xs text-gray-400 mt-1">Add time slots for {getFullDayName(activeDay)}</div>
              </div>
            )}

            {/* Weekly Summary */}
            <div className="mt-4 md:mt-6 pt-3 md:pt-4 border-t border-green-200">
              <div className="text-xs md:text-sm font-medium text-gray-700 mb-2 md:mb-3">Weekly Summary</div>
              <div className="grid grid-cols-7 gap-1">
                {daysOfWeek.map(day => {
                  const daySlots = formData.availability?.filter((s: any) => s.day === day) || [];
                  const hasSlots = daySlots.length > 0;
                  return (
                    <div key={day} className="text-center">
                      <div className={`text-xs font-medium ${
                        hasSlots ? 'text-green-600' : 'text-gray-400'
                      }`}>
                        {day.substring(0, 1)}
                      </div>
                      <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full text-xs flex items-center justify-center mx-auto border ${
                        hasSlots 
                          ? day === activeDay
                            ? 'bg-green-500 text-white border-green-600' 
                            : 'bg-green-100 text-green-700 border-green-300'
                          : 'bg-gray-100 text-gray-400 border-gray-300'
                      }`}>
                        {daySlots.length}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="text-xs text-gray-500 text-center mt-2">
                Numbers show total slots per day
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
