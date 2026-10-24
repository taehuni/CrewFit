export function monthDays(month) {
  const [year, number] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year, number - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return Array.from({length: Math.ceil((offset + count) / 7) * 7}, (_, i) => {
    const day = i - offset + 1;
    return day < 1 || day > count ? null : `${month}-${String(day).padStart(2, '0')}`;
  });
}
export function moveMonth(month, delta) {
  const [year, number] = month.split('-').map(Number);
  return new Date(Date.UTC(year, number - 1 + delta, 1)).toISOString().slice(0, 7);
}
export function koreaToday() {
  return new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Seoul', year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date());
}
