import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/index.js';
import { supabase } from '../../shared/supabaseClient.js';
import { queryKeys } from '../../shared/queryKeys.js';
import { loadMealPage } from './mealRecord.js';
import MealListView from './MealListView.jsx';

export default function MealsPage() {
  const { user } = useAuth();
  const meals = useInfiniteQuery({ queryKey: queryKeys.mealList(user.id), initialPageParam: null,
    queryFn: ({ pageParam, signal }) => loadMealPage(supabase, user.id, pageParam, signal), getNextPageParam: page => page.nextCursor });
  return <MealListView meals={meals} />;
}
