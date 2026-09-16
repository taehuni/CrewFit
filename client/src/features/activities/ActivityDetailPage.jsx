import { useLocation, useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/index.js';
import { supabase } from '../../shared/supabaseClient.js';
import { queryKeys } from '../../shared/queryKeys.js';
import { loadActivityDetail } from './activityDetail.js';
import ActivityDetailView from './ActivityDetailView.jsx';
import { deleteActivity, invalidateActivityData } from './activityMutations.js';
import { activitiesReturnTo } from './activityList.js';

export default function ActivityDetailPage() {
  const { activityId } = useParams();
  const { user } = useAuth();
  const cache = useQueryClient();
  const navigate = useNavigate();
  const returnTo = activitiesReturnTo(useLocation().state);
  const detail = useQuery({
    queryKey: queryKeys.activity(user.id, activityId),
    queryFn: () => loadActivityDetail(supabase, user.id, activityId),
  });
  async function remove() {
    const performedOn = detail.data.activity.performed_on;
    await deleteActivity(supabase, user.id, activityId);
    await cache.cancelQueries({ queryKey: queryKeys.activity(user.id, activityId), exact: true });
    cache.removeQueries({ queryKey: queryKeys.activity(user.id, activityId), exact: true });
    navigate(returnTo || '/home', { replace: true, state: { performedOn } });
    await invalidateActivityData(cache, user.id);
  }
  return <ActivityDetailView detail={detail} onDelete={remove} />;
}
