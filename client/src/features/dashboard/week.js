export function kstToday(now = new Date()) {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
export function weekDates(today, offset = 0) {
  const date = new Date(today + 'T00:00:00Z');
  const monday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - monday + offset * 7);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(date);
    day.setUTCDate(day.getUTCDate() + index);
    return day.toISOString().slice(0, 10);
  });
}
export const shortDate = date => date.slice(5).replace('-', '.');
export function weekLabel(days) {
  const start = days[0].replaceAll('-', '.');
  const end = days[0].slice(0, 4) === days[6].slice(0, 4)
    ? shortDate(days[6]) : days[6].replaceAll('-', '.');
  return `${start} — ${end}`;
}
