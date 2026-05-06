import { format, parseISO } from 'date-fns';

export function toDateInput(date = new Date()) {
  return format(date, 'yyyy-MM-dd');
}

export function toTimeInput(date = new Date()) {
  return format(date, 'HH:mm');
}

export function slotToDate(slot) {
  return parseISO(`${slot.slot_date}T${slot.slot_time}`);
}

export function readableSlot(slot) {
  if (!slot) return '';
  return `${format(slotToDate(slot), 'EEE, MMM d')} at ${slot.slot_time.slice(0, 5)}`;
}
