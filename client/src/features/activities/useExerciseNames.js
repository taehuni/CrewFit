import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/index.js';
import { supabase } from '../../shared/supabaseClient.js';
import { queryKeys } from '../../shared/queryKeys.js';
import { loadExerciseNames } from './exerciseNames.js';

export function useExerciseNames() {
  const { user } = useAuth();
  const [requested, setRequested] = useState(false);
  const query = useQuery({
    queryKey: queryKeys.exerciseNames(user.id),
    queryFn: ({ signal }) => loadExerciseNames(supabase, user.id, signal),
    enabled: requested,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  return {
    exerciseNames: query.data || [],
    exerciseNamesPending: requested && query.isPending,
    exerciseNamesError: query.isError,
    onExerciseNameFocus: () => setRequested(true),
    onExerciseNamesRetry: () => query.refetch(),
  };
}
