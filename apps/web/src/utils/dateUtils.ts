import { GENDER } from '@agam-plus/shared';
import { format, startOfWeek, endOfWeek, isWithinInterval, parseISO, startOfDay, endOfDay, addDays, addMonths, parse, addWeeks, isSameDay, isSameWeek } from 'date-fns';

export function calculateDuration(startDate: string, endDate: string): string {
  if (!startDate || !endDate) return "";

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return "";

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonthDays = new Date(end.getFullYear(), end.getMonth(), 0).getDate();
    days += prevMonthDays;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (days >= 28) {  // Roll full months
    months += 1;
    days = 0;
  }

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} year${years > 1 ? "s" : ""}`);
  if (months > 0) parts.push(`${months} month${months > 1 ? "s" : ""}`);
  if (days > 0) parts.push(`${days} day${days > 1 ? "s" : ""}`);

  return parts.length > 0 ? parts.join(" ") : "0 days";
}

export const generateAppointments = (
  startDate: string,
  endDate: string,
  frequency: "Daily" | "Weekly" | "Monthly" | "Once",
  weeklyDays: string[] = [],
  monthlyDates: number[] = [],
  appointmentTime?: string
): Date[] => {
  const appointments: Date[] = [];
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : null;

  if (frequency === "Once") {
    appointments.push(combineDateAndTime(start, appointmentTime));
    return appointments;
  }

  const current = new Date(start);

  while (!end || current <= end) {
    let shouldAdd = false;

    switch (frequency) {
      case "Daily":
        shouldAdd = true;
        break;
      case "Weekly": {
        const dayName = current.toLocaleDateString("en-US", { weekday: "long" });
        shouldAdd = weeklyDays.includes(dayName);
        break;
      }
      case "Monthly": {
        const date = current.getDate();
        shouldAdd = monthlyDates.includes(date);
        break;
      }
    }

    if (shouldAdd) {
      appointments.push(combineDateAndTime(new Date(current), appointmentTime));
    }

    current.setDate(current.getDate() + 1);
    if (end && current > end) break;
  }

  return appointments;
};

const combineDateAndTime = (date: Date | string, timeString?: string): Date => {
  const newDate = typeof date === "string" ? new Date(date) : new Date(date);
  if (timeString) {
    const [hours, minutes] = timeString.split(":").map(Number);
    newDate.setHours(hours, minutes, 0, 0);
  }
  return newDate;
};

export const calculateAge = (dobString: string): number | null => {
  if (!dobString) return null;
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
};

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};

export const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
};

export const isDateInPast = (dateString: string): boolean => {
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && date < new Date();
};

export const isDateInFuture = (dateString: string): boolean => {
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && date > new Date();
};

export const getSalutation = (gender: string, maritalStatus?: string): string => {
  if (!gender) return "";
  const g = gender.toLowerCase();
  const m = maritalStatus?.toLowerCase();
  if (g === GENDER.MALE) return "Mr.";
  if (g === GENDER.FEMALE) return m === "married" ? "Mrs." : "Miss";
  return "";
};

export const formatAppointmentDate = (dateString: string) => {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return { date: "Invalid date", day: "??", month: "???" };
  return {
    date: date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
    day: date.getDate(),
    month: date.toLocaleDateString("en-US", { month: "short" }),
    year: date.getFullYear(),
  };
};


export function groupAppointmentsByWeek(
  appointments: { date: string }[]
): { [key: string]: any[] } {
  const grouped: { [key: string]: any[] } = {};

  appointments.forEach((appt) => {
    // Safely parse yyyy-mm-dd string
    const date = parseISO(appt.date);

    const weekStart = startOfWeek(date, { weekStartsOn: 1 }); // Monday
    const weekEnd = endOfWeek(date, { weekStartsOn: 1 });

    const key = `${format(weekStart, "dd MMM")} - ${format(
      weekEnd,
      "dd MMM yyyy"
    )}`;

    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(appt);
  });

  return grouped;
}

export function isCurrentWeek(date: Date): boolean {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  return isWithinInterval(date, { start: weekStart, end: weekEnd });
}

export const statusColors: { [key: string]: string } = {
  scheduled: "bg-brand-violet-soft text-brand-violet",
  completed: "bg-status-open-soft text-status-open",
  cancelled: "bg-status-danger-soft text-status-danger",
  "no-show": "bg-surface-canvas text-ink-500",
};

export function getDateRange(dateFilter: string) {
  const today = new Date();
  
  switch (dateFilter) {
    case 'today':
      return {
        start: format(startOfDay(today), 'yyyy-MM-dd'),
        end: format(endOfDay(today), 'yyyy-MM-dd')
      };
    case 'f_week':
      return {
        start: format(startOfDay(today), 'yyyy-MM-dd'),
        end: format(endOfDay(addDays(today, 7)), 'yyyy-MM-dd')
      };
    case 'f_month':
      return {
        start: format(startOfDay(today), 'yyyy-MM-dd'),
        end: format(endOfDay(addDays(today, 30)), 'yyyy-MM-dd')
      };
    case 'f_3months':
      return {
        start: format(startOfDay(today), 'yyyy-MM-dd'),
        end: format(endOfDay(addMonths(today, 3)), 'yyyy-MM-dd')
      };
    case 'f_6months':
      return {
        start: format(startOfDay(today), 'yyyy-MM-dd'),
        end: format(endOfDay(addMonths(today, 6)), 'yyyy-MM-dd')
      };
    default:
      return {
        start: format(startOfDay(today), 'yyyy-MM-dd'),
        end: format(endOfDay(addDays(today, 30)), 'yyyy-MM-dd')
      };
  }
}

// Calendar view utilities
export interface CalendarDay {
  date: Date;
  dateString: string;
  dayOfWeek: string;
  dayNumber: number;
  isToday: boolean;
  isWeekend: boolean;
}

export function getWeekDays(startDate: Date): CalendarDay[] {
  const days: CalendarDay[] = [];
  const today = startOfDay(new Date());
  
  for (let i = 0; i < 7; i++) {
    const date = addDays(startDate, i);
    const dateString = format(date, 'yyyy-MM-dd');
    
    days.push({
      date,
      dateString,
      dayOfWeek: format(date, 'EEE'),
      dayNumber: date.getDate(),
      isToday: format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd'),
      isWeekend: date.getDay() === 0 || date.getDay() === 6
    });
  }
  
  return days;
}

export function getMonthWeeks(year: number, month: number): CalendarDay[][] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDate = startOfWeek(firstDay, { weekStartsOn: 1 });
  const endDate = endOfWeek(lastDay, { weekStartsOn: 1 });
  
  const weeks: CalendarDay[][] = [];
  let currentDate = startDate;
  
  while (currentDate <= endDate) {
    const week = getWeekDays(currentDate);
    weeks.push(week);
    currentDate = addDays(currentDate, 7);
  }
  
  return weeks;
}

export function groupAppointmentsByDateAndTime(appointments: any[]): { [date: string]: { [time: string]: any[] } } {
  const grouped: { [date: string]: { [time: string]: any[] } } = {};
  
  appointments.forEach((appt) => {
    const dateKey = appt.date;
    const timeKey = appt.time;
    
    if (!grouped[dateKey]) {
      grouped[dateKey] = {};
    }
    
    if (!grouped[dateKey][timeKey]) {
      grouped[dateKey][timeKey] = [];
    }
    
    grouped[dateKey][timeKey].push(appt);
  });
  
  return grouped;
}

export function getTimeSlots(startHour: number = 8, endHour: number = 20): string[] {
  const slots: string[] = [];
  
  for (let hour = startHour; hour <= endHour; hour++) {
    slots.push(`${hour.toString().padStart(2, '0')}:00`);
  }
  
  return slots;
}

export function getDateCategory(dateString: string): string {
  const appointmentDate = parse(dateString, "yyyy-MM-dd", new Date(2000, 0, 1));
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const nextWeek = addWeeks(today, 1);

  if (isSameDay(appointmentDate, today)) {
    return 'Today';
  } else if (isSameDay(appointmentDate, tomorrow)) {
    return 'Tomorrow';
  } else if (isSameWeek(appointmentDate, today)) {
    return 'This Week';
  } else if (isWithinInterval(appointmentDate, { start: tomorrow, end: nextWeek })) {
    return 'Next Week';
  } else {
    return format(appointmentDate, "EEE, MMM d");
  }
}