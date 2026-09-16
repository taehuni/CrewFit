import { useSearchParams } from 'react-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/index.js';
import { supabase } from '../../shared/supabaseClient.js';
import { queryKeys } from '../../shared/queryKeys.js';
import { filterError, listFilters, listURL, loadActivityPage } from './activityList.js';
import ActivityListView from './ActivityListView.jsx';

export default function ActivitiesPage() {
  const { user } = useAuth();
  const [search, setSearch] = useSearchParams();
  const filters = listFilters(search);
  const error = filterError(filters);
  const records = useInfiniteQuery({
    queryKey: queryKeys.activityList(user.id, filters),
    initialPageParam: null,
    queryFn: ({ pageParam, signal }) => loadActivityPage(supabase, user.id, filters, pageParam, signal),
    getNextPageParam: page => page.nextCursor,
    enabled: !error,
  });
  return <ActivityListView filters={filters} filterMessage={error} records={records}
    onFilter={next => setSearch(listURL(next).split('?')[1] || '')} />;
}
