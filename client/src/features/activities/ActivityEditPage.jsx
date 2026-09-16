import { useLocation, useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/index.js';
import { supabase } from '../../shared/supabaseClient.js';
import { queryKeys } from '../../shared/queryKeys.js';
import { loadActivityDetail } from './activityDetail.js';
import { activityFormValues } from './record.js';
import { updateActivity, invalidateActivityData } from './activityMutations.js';
import ActivityDetailView from './ActivityDetailView.jsx';
import ActivityForm from './ActivityForm.jsx';
import { activitiesReturnTo } from './activityList.js';
import { ACTIVITY_SPORTS } from './sports.js';
import { useExerciseNames } from './useExerciseNames.js';

export default function ActivityEditPage() {
  const { activityId } = useParams();
  const { user } = useAuth();
  const exerciseNames = useExerciseNames();
  const cache = useQueryClient();
  const navigate = useNavigate();
  const returnTo = activitiesReturnTo(useLocation().state);
  const detail = useQuery({
    queryKey: queryKeys.activity(user.id, activityId),
    queryFn: () => loadActivityDetail(supabase, user.id, activityId),
  });
  if (!detail.data) return <ActivityDetailView detail={detail} />;
  if (!ACTIVITY_SPORTS.includes(detail.data.activity.sport)) return <ActivityDetailView detail={detail} />;
  async function save(payload) {
    await updateActivity(supabase, user.id, activityId, payload);
    await invalidateActivityData(cache, user.id);
    navigate(returnTo || '/home', { replace: true, state: { performedOn: payload.activity.performed_on } });
  }
  return <ActivityForm {...exerciseNames} key={activityId} editing initialValues={activityFormValues(detail.data)}
    cancelTo={`/activities/${activityId}`} onSave={save} />;
}
