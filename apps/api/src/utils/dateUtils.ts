import { format, parse, startOfDay, addDays, addWeeks, isSameDay, isSameWeek, isWithinInterval } from 'date-fns';

export function getDateCategory(dateString: string): string {
  const appointmentDate = parse(dateString, 'yyyy-MM-dd', new Date(2000, 0, 1));
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
    return format(appointmentDate, 'EEE, MMM d');
  }
}
