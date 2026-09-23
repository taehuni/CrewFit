import { useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/index.js';
import { supabase } from '../../shared/supabaseClient.js';
import { queryKeys } from '../../shared/queryKeys.js';
import { invalidateMeals, loadMealDetail, mealFormValues, updateMeal } from './mealRecord.js';
import MealDetailView from './MealDetailView.jsx';
import MealForm from './MealForm.jsx';

export default function MealEditPage() {
  const { mealId } = useParams(); const { user } = useAuth(); const cache = useQueryClient(); const navigate = useNavigate();
  const detail = useQuery({ queryKey: queryKeys.meal(user.id, mealId), queryFn: () => loadMealDetail(supabase, user.id, mealId) });
  if (!detail.data) return <MealDetailView detail={detail} />;
  async function save(meal) { await updateMeal(supabase, user.id, mealId, meal); await invalidateMeals(cache, user.id); navigate('/meals/' + mealId, { replace: true }); }
  return <MealForm editing initialValues={mealFormValues(detail.data)} cancelTo={'/meals/' + mealId} onSave={save} />;
}
