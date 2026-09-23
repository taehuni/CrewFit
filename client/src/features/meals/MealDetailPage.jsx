import { useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/index.js';
import { supabase } from '../../shared/supabaseClient.js';
import { queryKeys } from '../../shared/queryKeys.js';
import { deleteMeal, invalidateMeals, loadMealDetail } from './mealRecord.js';
import MealDetailView from './MealDetailView.jsx';

export default function MealDetailPage() {
  const { mealId } = useParams(); const { user } = useAuth(); const cache = useQueryClient(); const navigate = useNavigate();
  const detail = useQuery({ queryKey: queryKeys.meal(user.id, mealId), queryFn: () => loadMealDetail(supabase, user.id, mealId) });
  async function remove() { await deleteMeal(supabase, user.id, mealId); await cache.cancelQueries({ queryKey: queryKeys.meal(user.id, mealId), exact: true }); cache.removeQueries({ queryKey: queryKeys.meal(user.id, mealId), exact: true }); navigate('/meals', { replace: true }); await invalidateMeals(cache, user.id); }
  return <MealDetailView detail={detail} onDelete={remove} />;
}
