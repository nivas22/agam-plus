'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Clock, Plus, Trash2, Calendar, CheckCircle, XCircle, ArrowLeft, Save } from "lucide-react";
import { TimeSlot } from "@/types/appointment";
import { useAvailabilityApi } from '@/hooks/useAvailability';

interface AvailabilityData {
  availability: TimeSlot[];
  appointmentDuration: number;
}

export default function AvailabilityPage() {
  const params = useParams();
  const router = useRouter();
  const hospitalId = params.id as string;
  const doctorId = params.doctorId as string;

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  // const timeOptions = [
  //   '00:00', '00:30', '01:00', '01:30', '02:00', '02:30', '03:00', '03:30',
  //   '04:00', '04:30', '05:00', '05:30', '06:00', '06:30', '07:00', '07:30',
  //   '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  //   '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  //   '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
  //   '20:00', '20:30', '21:00', '21:30', '22:00', '22:30', '23:00', '23:30'
  // ];

  const { saveAvailability, isSaving, availability, isLoading } = useAvailabilityApi(hospitalId, doctorId);
  
  const [formData, setFormData] = useState<AvailabilityData>({
    availability: [],
    appointmentDuration: 30,
  });
  const [activeDay, setActiveDay] = useState('Monday');
  const [newTimeSlot, setNewTimeSlot] = useState<TimeSlot>({ day: 'Monday', startTime: '', endTime: '' });
  const [saveMessage, setSaveMessage] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Time picker state
  const [startHour, setStartHour] = useState('09');
  const [startMinute, setStartMinute] = useState('00');
  const [startPeriod, setStartPeriod] = useState<'AM' | 'PM'>('AM');
  const [endHour, setEndHour] = useState('05');
  const [endMinute, setEndMinute] = useState('00');
  const [endPeriod, setEndPeriod] = useState<'AM' | 'PM'>('PM');

  // Load existing availability data from the hook
  useEffect(() => {
    if (availability) {
      setFormData({
        availability: availability.availability || [],
        appointmentDuration: availability.appointmentDuration || 30,
      });
    }
  }, [availability]);

  const formatTimeForDisplay = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${period}`;
  };

  // Convert 12-hour format to 24-hour format
  const convertTo24Hour = (hour: string, minute: string, period: 'AM' | 'PM'): string => {
    let hour24 = parseInt(hour);
    if (period === 'PM' && hour24 !== 12) {
      hour24 += 12;
    } else if (period === 'AM' && hour24 === 12) {
      hour24 = 0;
    }
    return `${hour24.toString().padStart(2, '0')}:${minute}`;
  };

  // Update newTimeSlot when time picker values change
  useEffect(() => {
    const startTime = convertTo24Hour(startHour, startMinute, startPeriod);
    const endTime = convertTo24Hour(endHour, endMinute, endPeriod);
    setNewTimeSlot({ day: activeDay, startTime, endTime });
  }, [startHour, startMinute, startPeriod, endHour, endMinute, endPeriod, activeDay]);

  const getActiveDayAvailability = () => {
    return formData.availability?.filter(slot => slot.day === activeDay) || [];
  };

  const isTimeSlotValid = () => {
    if (!newTimeSlot.startTime || !newTimeSlot.endTime) return false;
    
    if (newTimeSlot.startTime >= newTimeSlot.endTime) return false;
    
    const activeDaySlots = getActiveDayAvailability();
    if (activeDaySlots.length === 0) return true;
    
    const newStart = newTimeSlot.startTime;
    const newEnd = newTimeSlot.endTime;
    
    const hasOverlap = activeDaySlots.some(slot => {
      const slotStart = slot.startTime;
      const slotEnd = slot.endTime;
      
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
      'Monday': 'Monday',
      'Tuesday': 'Tuesday',
      'Wednesday': 'Wednesday',
      'Thursday': 'Thursday',
      'Friday': 'Friday',
      'Saturday': 'Saturday',
      'Sunday': 'Sunday'
    };
    return dayMap[day] || day;
  };

  const addTimeSlot = () => {
    if (isTimeSlotValid()) {
      setFormData(prev => ({
        ...prev,
        availability: [...prev.availability, { ...newTimeSlot }]
      }));
      clearTimeSlot();
      setIsModalOpen(false);
    }
  };

  const openModal = () => {
    setIsModalOpen(true);
  };

  const removeTimeSlot = (day: string, index: number) => {
    setFormData(prev => ({
      ...prev,
      availability: prev.availability.filter((slot, i) => !(slot.day === day && i === index))
    }));
  };

  const clearTimeSlot = () => {
    setStartHour('09');
    setStartMinute('00');
    setStartPeriod('AM');
    setEndHour('05');
    setEndMinute('00');
    setEndPeriod('PM');
  };

  // const getAvailableTimeOptions = (type: 'start' | 'end') => {
  //   const activeDaySlots = getActiveDayAvailability();
    
  //   if (activeDaySlots.length === 0) {
  //     return timeOptions;
  //   }

  //   if (type === 'start') {
  //     return timeOptions.filter(time => {
  //       const isInExistingSlot = activeDaySlots.some(slot => 
  //         time >= slot.startTime && time < slot.endTime
  //       );
  //       return !isInExistingSlot;
  //     });
  //   } else {
  //     if (!newTimeSlot.startTime) {
  //       return timeOptions;
  //     }
      
  //     return timeOptions.filter(time => {
  //       if (time <= newTimeSlot.startTime!) return false;
        
  //       const wouldOverlap = activeDaySlots.some(slot => {
  //         return (
  //           (newTimeSlot.startTime! < slot.endTime && time > slot.startTime)
  //         );
  //       });
        
  //       return !wouldOverlap;
  //     });
  //   }
  // };

  const handleSave = async () => {
    setSaveMessage('');
    
    try {
      await saveAvailability(formData.availability, formData.appointmentDuration);
      
      setSaveMessage('Availability saved successfully!');
      setTimeout(() => {
        setSaveMessage('');
        router.back();
      }, 2000);
    } catch (error) {
      console.error('Failed to save availability:', error);
      setSaveMessage(error instanceof Error ? error.message : 'Failed to save availability. Please try again.');
    }
  };

  const activeDaySlots = getActiveDayAvailability();
  const isValidSlot = isTimeSlotValid();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-violet-soft via-brand-violet-soft to-brand-violet-soft flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-violet mx-auto mb-4"></div>
          <p className="text-ink-700 font-medium">Loading availability...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-violet-soft via-brand-violet-soft to-brand-violet-soft">
      {/* Fixed Header */}
      <div className="sticky top-0 z-10 bg-surface-paper/95 backdrop-blur-sm border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-surface-canvas rounded-lg transition-colors"
                aria-label="Go back"
              >
                <ArrowLeft className="w-5 h-5 text-ink-700" />
              </button>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-ink-900 flex items-center gap-2">
                  <Clock className="w-6 h-6 text-brand-violet" />
                  Manage Availability
                </h1>
                <p className="text-xs md:text-sm text-ink-700 mt-0.5">Set your working hours and appointment slots</p>
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={isSaving || formData.availability.length === 0}
              className="flex items-center gap-2 px-4 md:px-6 py-2 md:py-2.5 bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-semibold rounded-lg transition-all shadow-md hover:shadow-lg disabled:bg-border disabled:cursor-not-allowed disabled:shadow-none"
            >
              <Save className="w-4 h-4" />
              <span className="hidden md:inline">{isSaving ? 'Saving...' : 'Save Changes'}</span>
              <span className="md:hidden">{isSaving ? 'Saving...' : 'Save'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        {/* Save Message */}
        {saveMessage && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
            saveMessage.includes('success')
              ? 'bg-status-open-soft text-status-open border border-status-open/20'
              : 'bg-status-danger-soft text-status-danger border border-status-danger/20'
          }`}>
            {saveMessage.includes('success') ? (
              <CheckCircle className="w-5 h-5 text-status-open flex-shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-status-danger flex-shrink-0" />
            )}
            <span className="font-medium">{saveMessage}</span>
          </div>
        )}

        <div className="space-y-4">
          {/* Step 1 Header */}
          <div className="sticky top-[73px] z-20 -mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-gradient-to-r from-brand-violet-soft to-brand-violet-soft backdrop-blur-sm bg-opacity-95">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-brand-violet-soft text-brand-violet font-bold text-xs flex-shrink-0 border-2 border-brand-violet/20">
                1
              </div>
              <div>
                <h4 className="font-bold text-base text-ink-900">Appointment Duration</h4>
                <p className="text-xs text-ink-700">How long should each appointment last?</p>
              </div>
            </div>
          </div>

          {/* Appointment Duration Content */}
          <div className="bg-surface-paper p-4 md:p-5 rounded-xl border-2 border-border shadow-sm hover:shadow-md transition-shadow">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <label className="text-sm text-ink-700 font-medium">Duration:</label>
              <div className="flex items-center gap-2 bg-surface-paper px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg border-2 border-border focus-within:border-brand-violet transition-colors">
                <input
                  type="number"
                  inputMode="numeric"
                  min="5"
                  max="240"
                  step="5"
                  value={formData.appointmentDuration}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val) && val >= 5 && val <= 240) {
                      setFormData((prev) => ({ ...prev, appointmentDuration: val }));
                    }
                  }}
                  className="w-16 sm:w-20 text-center text-lg sm:text-xl font-bold text-ink-900 bg-transparent focus:outline-none [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-auto [&::-webkit-inner-spin-button]:appearance-auto"
                  placeholder="30"
                />
                <span className="text-sm sm:text-base font-semibold text-ink-700">minutes</span>
              </div>
              <span className="text-xs text-ink-500">(5-240 min)</span>
            </div>
          </div>

          {/* Step 2 Header - Sticky */}
          <div className="sticky top-[73px] z-20 -mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-gradient-to-r from-status-open-soft to-status-open-soft border-y border-status-open/20 backdrop-blur-sm bg-opacity-95">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-status-open-soft text-status-open font-bold text-xs flex-shrink-0 border-2 border-status-open/20">
                2
              </div>
              <div>
                <h4 className="font-bold text-base text-ink-900">Configure Weekly Schedule</h4>
                <p className="text-xs text-ink-700">Add time slots for each day you're available</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {/* Day Selection Panel */}
            <div className="bg-gradient-to-br from-surface-paper to-surface-canvas p-4 rounded-xl border-2 border-border shadow-sm hover:shadow-md transition-shadow lg:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-status-open-soft rounded-lg">
                  <Calendar className="w-4 h-4 text-status-open" />
                </div>
                <h5 className="font-bold text-sm text-ink-900">Select Day</h5>
              </div>
              <p className="text-xs text-ink-700 mb-3">Choose a day to configure</p>
              <div className="grid grid-cols-7 gap-1.5">
                {daysOfWeek.map((day) => {
                  const daySlots = formData.availability?.filter((s: any) => s.day === day) || [];
                  const hasAvailability = daySlots.length > 0;
                  const isActive = activeDay === day;
                  
                  return (
                    <button
                      key={day}
                      onClick={() => {
                        setActiveDay(day);
                        setNewTimeSlot({ day, startTime: '', endTime: '' });
                      }}
                      className={`relative p-2.5 rounded-xl transition-all duration-300 flex flex-col items-center justify-center group ${
                        isActive
                          ? "bg-gradient-to-br from-brand-violet to-brand-violet text-white shadow-lg scale-105 ring-2 ring-brand-violet/20"
                          : hasAvailability
                            ? "bg-gradient-to-br from-status-open-soft to-status-open-soft text-status-open border-2 border-status-open/20 hover:shadow-md hover:scale-105"
                            : "bg-surface-paper text-ink-700 border-2 border-border hover:border-brand-violet hover:shadow-sm hover:scale-105"
                      }`}
                    >
                      <span className={`font-bold text-[10px] mb-0.5 ${isActive ? 'text-white' : ''}`}>
                        {day.substring(0, 1).toUpperCase()}
                      </span>
                      <span className={`font-semibold text-xs ${isActive ? 'text-white' : ''}`}>
                        {day.substring(0, 3).toUpperCase()}
                      </span>
                      
                      {hasAvailability && !isActive && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-status-open rounded-full flex items-center justify-center shadow-md border-2 border-white">
                          <span className="text-[10px] font-bold text-white">{daySlots.length}</span>
                        </div>
                      )}
                      
                      {isActive && (
                        <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-white rounded-full shadow-md"></div>
                      )}
                    </button>
                  );
                })}
              </div>
              
              {/* Legend */}
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-gradient-to-br from-brand-violet to-brand-violet"></div>
                  <span className="text-ink-700">Active</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-gradient-to-br from-status-open-soft to-status-open-soft border border-status-open/20"></div>
                  <span className="text-ink-700">Has Slots</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-surface-paper border border-border"></div>
                  <span className="text-ink-700">Empty</span>
                </div>
              </div>
            </div>

            {/* Time Slots Display Panel */}
            <div className="bg-surface-paper p-4 rounded-xl border-2 border-brand-violet/20 shadow-sm hover:shadow-md transition-shadow lg:col-span-1">
              <div className="bg-gradient-to-r from-brand-violet-soft to-brand-violet-soft -mx-4 -mt-4 px-4 py-3 mb-4 rounded-t-xl border-b border-brand-violet/20">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-brand-violet" />
                      <h5 className="font-bold text-base text-ink-900">
                        <span className="text-brand-violet capitalize">{getFullDayName(activeDay)}</span> Time Slots
                      </h5>
                    </div>
                    <p className="text-xs text-ink-700 mt-1">Manage your available hours</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {/* Current Slots Display */}
                {activeDaySlots.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-ink-700 uppercase tracking-wide mb-2">
                      Current Slots ({activeDaySlots.length})
                    </div>
                    {activeDaySlots.map((slot, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gradient-to-r from-brand-violet-soft to-brand-violet-soft rounded-lg border-2 border-brand-violet/20 hover:shadow-sm transition-shadow">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-brand-violet rounded-full"></div>
                          <span className="text-sm font-semibold text-ink-900">
                            {formatTimeForDisplay(slot.startTime)} - {formatTimeForDisplay(slot.endTime)}
                          </span>
                        </div>
                        <button
                          onClick={() => removeTimeSlot(activeDay, index)}
                          className="p-1.5 text-status-danger hover:bg-status-danger-soft rounded-lg transition-colors"
                          title="Remove time slot"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 bg-surface-canvas rounded-lg border-2 border-dashed border-border">
                    <Clock className="w-12 h-12 text-ink-500 mx-auto mb-2" />
                    <p className="text-sm text-ink-700 font-medium">No time slots added yet</p>
                    <p className="text-xs text-ink-500 mt-1">Click the button below to add your first slot</p>
                  </div>
                )}

                {/* Add Time Slot Button */}
                <button
                  onClick={openModal}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-brand-violet to-brand-violet hover:from-brand-violet-hover hover:to-brand-violet-hover text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all"
                >
                  <Plus className="w-5 h-5" />
                  <span>Add Time Slot</span>
                </button>
              </div>
            </div>

            {/* Preview Panel */}
            <div className="bg-gradient-to-br from-status-open-soft to-status-open-soft p-4 rounded-xl border-2 border-status-open/20 shadow-sm hover:shadow-md transition-shadow lg:col-span-1 lg:col-start-1 xl:col-start-3">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-status-open text-white">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <h5 className="font-bold text-base text-ink-900">Preview</h5>
                  <p className="text-xs text-ink-700">Your current schedule</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Active Day Summary */}
                <div className="text-center p-4 bg-gradient-to-br from-brand-violet-soft to-brand-violet-soft rounded-lg border border-brand-violet/20">
                  <div className="text-xl font-bold text-brand-violet capitalize">
                    {getFullDayName(activeDay)}
                  </div>
                  <div className="text-sm text-ink-500">
                    {activeDaySlots.length} time slot{activeDaySlots.length !== 1 ? 's' : ''} configured
                  </div>
                </div>

                {/* Time Slots Preview */}
                {activeDaySlots.length > 0 ? (
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-ink-700">Time Slots:</div>
                    {activeDaySlots.map((slot, index) => (
                      <div key={index} className="bg-gradient-to-r from-status-open-soft to-status-open-soft p-3 rounded-lg border border-status-open/20 shadow-sm">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${
                              index === 0 ? 'bg-status-open' :
                              index === 1 ? 'bg-brand-violet' :
                              index === 2 ? 'bg-status-warning' : 'bg-brand-violet'
                            }`}></div>
                            <span className="font-medium text-sm text-ink-900">
                              {formatTimeForDisplay(slot.startTime)} - {formatTimeForDisplay(slot.endTime)}
                            </span>
                          </div>
                          <div className="text-xs text-ink-500">
                            Slot {index + 1}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 bg-surface-canvas rounded-lg border border-dashed border-border">
                    <Clock className="w-12 h-12 text-ink-500 mx-auto mb-2" />
                    <div className="text-sm text-ink-500 font-medium">No time slots added</div>
                    <div className="text-xs text-ink-500 mt-1">Add time slots for {getFullDayName(activeDay)}</div>
                  </div>
                )}

                {/* Weekly Summary */}
                <div className="mt-6 pt-4 border-t border-border">
                  <div className="text-sm font-medium text-ink-700 mb-3">Weekly Summary</div>
                  <div className="grid grid-cols-7 gap-1">
                    {daysOfWeek.map(day => {
                      const daySlots = formData.availability?.filter((s: any) => s.day === day) || [];
                      const hasSlots = daySlots.length > 0;
                      return (
                        <div key={day} className="text-center">
                          <div className={`text-xs font-medium mb-1 ${
                            hasSlots ? 'text-status-open' : 'text-ink-500'
                          }`}>
                            {day.substring(0, 1).toUpperCase()}
                          </div>
                          <div className={`w-8 h-8 rounded-full text-xs flex items-center justify-center mx-auto border ${
                            hasSlots
                              ? day === activeDay
                                ? 'bg-status-open text-white border-status-open-hover'
                                : 'bg-status-open-soft text-status-open border-status-open/20'
                              : 'bg-surface-canvas text-ink-500 border-border'
                          }`}>
                            {daySlots.length}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-xs text-ink-500 text-center mt-2">
                    Numbers show total slots per day
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Add Time Slot Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-trace-background/50 backdrop-blur-sm">
            <div className="bg-surface-paper rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-brand-violet to-brand-violet px-6 py-4 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <Clock className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Add Time Slot</h3>
                      <p className="text-xs text-brand-violet-soft">
                        <span className="capitalize">{getFullDayName(activeDay)}</span>
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <XCircle className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5">
                {/* Start Time Picker */}
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-ink-900 uppercase tracking-wide">Start Time</label>
                  <div className="flex items-center gap-2 bg-surface-canvas p-4 rounded-xl border-2 border-border focus-within:border-brand-violet transition-colors">
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max="12"
                      value={startHour}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || (parseInt(val) >= 1 && parseInt(val) <= 12)) {
                          setStartHour(val.padStart(2, '0'));
                        }
                      }}
                      className="w-16 text-center text-3xl font-bold text-ink-900 bg-transparent focus:outline-none [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-auto [&::-webkit-inner-spin-button]:appearance-auto"
                      placeholder="09"
                    />
                    <span className="text-3xl font-bold text-ink-500">:</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max="59"
                      step="15"
                      value={startMinute}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || (parseInt(val) >= 0 && parseInt(val) <= 59)) {
                          setStartMinute(val.padStart(2, '0'));
                        }
                      }}
                      className="w-16 text-center text-3xl font-bold text-ink-900 bg-transparent focus:outline-none [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-auto [&::-webkit-inner-spin-button]:appearance-auto"
                      placeholder="00"
                    />
                    <div className="flex ml-2 bg-border rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setStartPeriod('AM')}
                        className={`px-4 py-2 text-sm font-bold transition-colors ${
                          startPeriod === 'AM'
                            ? 'bg-brand-violet text-white'
                            : 'text-ink-700 hover:bg-border'
                        }`}
                      >
                        AM
                      </button>
                      <button
                        type="button"
                        onClick={() => setStartPeriod('PM')}
                        className={`px-4 py-2 text-sm font-bold transition-colors ${
                          startPeriod === 'PM'
                            ? 'bg-brand-violet text-white'
                            : 'text-ink-700 hover:bg-border'
                        }`}
                      >
                        PM
                      </button>
                    </div>
                  </div>
                </div>

                {/* End Time Picker */}
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-ink-900 uppercase tracking-wide">End Time</label>
                  <div className="flex items-center gap-2 bg-surface-canvas p-4 rounded-xl border-2 border-border focus-within:border-brand-violet transition-colors">
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max="12"
                      value={endHour}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || (parseInt(val) >= 1 && parseInt(val) <= 12)) {
                          setEndHour(val.padStart(2, '0'));
                        }
                      }}
                      className="w-16 text-center text-3xl font-bold text-ink-900 bg-transparent focus:outline-none [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-auto [&::-webkit-inner-spin-button]:appearance-auto"
                      placeholder="05"
                    />
                    <span className="text-3xl font-bold text-ink-500">:</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max="59"
                      step="15"
                      value={endMinute}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || (parseInt(val) >= 0 && parseInt(val) <= 59)) {
                          setEndMinute(val.padStart(2, '0'));
                        }
                      }}
                      className="w-16 text-center text-3xl font-bold text-ink-900 bg-transparent focus:outline-none [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-auto [&::-webkit-inner-spin-button]:appearance-auto"
                      placeholder="00"
                    />
                    <div className="flex ml-2 bg-border rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setEndPeriod('AM')}
                        className={`px-4 py-2 text-sm font-bold transition-colors ${
                          endPeriod === 'AM'
                            ? 'bg-brand-violet text-white'
                            : 'text-ink-700 hover:bg-border'
                        }`}
                      >
                        AM
                      </button>
                      <button
                        type="button"
                        onClick={() => setEndPeriod('PM')}
                        className={`px-4 py-2 text-sm font-bold transition-colors ${
                          endPeriod === 'PM'
                            ? 'bg-brand-violet text-white'
                            : 'text-ink-700 hover:bg-border'
                        }`}
                      >
                        PM
                      </button>
                    </div>
                  </div>
                </div>

                {/* Validation Messages */}
                {newTimeSlot.startTime && newTimeSlot.endTime && !isValidSlot && (
                  <div className="p-3 bg-status-danger-soft border-2 border-status-danger/20 rounded-xl">
                    <div className="flex items-center gap-2 text-status-danger text-sm font-medium">
                      <XCircle className="w-5 h-5 flex-shrink-0" />
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

                {/* Preview */}
                {isValidSlot && (
                  <div className="p-3 bg-status-open-soft border-2 border-status-open/20 rounded-xl">
                    <div className="flex items-center gap-2 text-status-open text-sm font-medium">
                      <CheckCircle className="w-5 h-5 flex-shrink-0" />
                      <span>
                        {formatTimeForDisplay(newTimeSlot.startTime)} - {formatTimeForDisplay(newTimeSlot.endTime)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-surface-canvas rounded-b-2xl flex gap-3">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3 bg-surface-paper border-2 border-border text-ink-700 font-semibold rounded-xl hover:bg-surface-canvas transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={addTimeSlot}
                  disabled={!isValidSlot}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 font-semibold rounded-xl transition-all ${
                    isValidSlot
                      ? "bg-gradient-to-r from-brand-violet to-brand-violet hover:from-brand-violet-hover hover:to-brand-violet-hover text-white shadow-lg"
                      : "bg-border text-ink-500 cursor-not-allowed"
                  }`}
                >
                  <Plus className="w-5 h-5" />
                  <span>Add Slot</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
