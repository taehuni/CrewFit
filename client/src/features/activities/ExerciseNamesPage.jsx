import { useLocation } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/index.js';
import { supabase } from '../../shared/supabaseClient.js';
import { api } from '../../shared/api.js';
import { queryKeys } from '../../shared/queryKeys.js';
import { activitiesReturnTo } from './activityList.js';
import { loadExerciseCatalog } from './exerciseMerge.js';
import ExerciseNamesView from './ExerciseNamesView.jsx';

export default function ExerciseNamesPage() {
  const { user, token } = useAuth();
  const cache = useQueryClient();
  const returnTo = activitiesReturnTo(useLocation().state) || '/activities';
  const catalog = useQuery({
    queryKey: queryKeys.exerciseCatalog(user.id),
    queryFn: ({ signal }) => loadExerciseCatalog(supabase, user.id, signal),
  });
  async function merge({ from, to }) {
    const result = await api('/exercises/merge', { token, body: { from, to } });
    await cache.invalidateQueries({ queryKey: queryKeys.activitiesRoot(user.id) });
    return result;
  }
  return <ExerciseNamesView catalog={catalog} onMerge={merge} returnTo={returnTo} />;
}
