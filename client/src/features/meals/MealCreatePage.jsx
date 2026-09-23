import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/index.js';
import { supabase } from '../../shared/supabaseClient.js';
import { createMeal, invalidateMeals } from './mealRecord.js';
import MealForm from './MealForm.jsx';

export default function MealCreatePage() {
  const { user } = useAuth(); const cache = useQueryClient(); const navigate = useNavigate();
  const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  async function save(meal) { const id = await createMeal(supabase, user.id, meal); await invalidateMeals(cache, user.id); navigate('/meals/' + id, { replace: true }); }
  return <MealForm today={today} onSave={save} />;
}
