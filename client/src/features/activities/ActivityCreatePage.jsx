import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/index.js';
import { supabase } from '../../shared/supabaseClient.js';
import { queryKeys } from '../../shared/queryKeys.js';
import ActivityForm from './ActivityForm.jsx';
import { saveActivity } from './record.js';
import { activitiesReturnTo } from './activityList.js';
import { initialActivitySport } from './sports.js';
import { useExerciseNames } from './useExerciseNames.js';

export default function ActivityCreatePage() {
  const { user } = useAuth();
  const exerciseNames = useExerciseNames();
  const cache = useQueryClient();
  const navigate = useNavigate();
  const returnTo = activitiesReturnTo(useLocation().state);
  const [search] = useSearchParams();
  const sport = initialActivitySport(search.get('sport'));
  const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  async function save(payload) {
    await saveActivity(supabase, user.id, payload);
    await Promise.all([
      cache.invalidateQueries({ queryKey: queryKeys.activitiesRoot(user.id) }),
      cache.invalidateQueries({ queryKey: queryKeys.dashboardRoot(user.id) }),
    ]);
    navigate('/home', { state: { performedOn: payload.activity.performed_on } });
  }
  return <ActivityForm {...exerciseNames} key={sport} initialSport={sport} today={today} cancelTo={returnTo || '/home'} onSave={save} />;
}
