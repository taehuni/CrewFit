import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/index.js';
import { supabase } from '../../shared/supabaseClient.js';
import { queryKeys } from '../../shared/queryKeys.js';
import { changeGoal, invalidateGoals, loadGoals, saveGoal } from './goals.js';
import GoalsView from './GoalsView.jsx';

export default function GoalsPage() {
  const { user } = useAuth();
  const cache = useQueryClient();
  const goals = useQuery({ queryKey: queryKeys.goals(user.id), queryFn: ({ signal }) => loadGoals(supabase, user.id, signal) });
  async function save(form, id) { await saveGoal(supabase, user.id, form, id); await invalidateGoals(cache, user.id); }
  async function change(id, active) { await changeGoal(supabase, user.id, id, active); await invalidateGoals(cache, user.id); }
  return <GoalsView goals={goals} onSave={save} onChange={change} />;
}
