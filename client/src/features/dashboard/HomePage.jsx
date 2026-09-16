import { useState } from 'react';
import { useLocation } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/index.js';
import { api } from '../../shared/api.js';
import { queryKeys } from '../../shared/queryKeys.js';
import HomeView from './HomeView.jsx';
import { kstToday, weekDates } from './week.js';

export default function HomePage() {
  const { user, token } = useAuth();
  const location = useLocation();
  const today = kstToday();
  const [offset, setOffset] = useState(() => {
    const savedDate = location.state?.performedOn;
    if (!savedDate || !/^\d{4}-\d{2}-\d{2}$/.test(savedDate)) return 0;
    const start = weekDates(savedDate)[0];
    const difference = (Date.parse(start) - Date.parse(weekDates(today)[0])) / (7 * 86400000);
    return Number.isFinite(difference) ? difference : 0;
  });
  const days = weekDates(today, offset);
  const log = useQuery({
    queryKey: queryKeys.dashboard(user.id, 'week', days[0]),
    queryFn: () => api(`/dashboard?period=week&date=${days[0]}`, { token }),
  });
  return <HomeView log={log} days={days} today={today} offset={offset} onWeekChange={setOffset} />;
}
