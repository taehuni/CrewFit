import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { loadGpsDraft, finalizeGpsDraft } from '../tracking/index.js';
import { useAuth } from '../auth/index.js';
import { supabase } from '../../shared/supabaseClient.js';
import { queryKeys } from '../../shared/queryKeys.js';
import ActivityForm from './ActivityForm.jsx';
import { saveActivity, activityFormValues } from './record.js';
import { activitiesReturnTo } from './activityList.js';
import { initialActivitySport } from './sports.js';
import { useExerciseNames } from './useExerciseNames.js';

export default function ActivityCreatePage() {
  const { user } = useAuth();
  const exerciseNames = useExerciseNames();
  const cache = useQueryClient();
  const navigate = useNavigate();
  const returnTo = activitiesReturnTo(useLocation().state);
  const [search, setSearch] = useSearchParams();
  const draftId = search.get('gpsDraft');
  const draft = useQuery({queryKey:queryKeys.gpsDraft(user.id,draftId),queryFn:({signal})=>loadGpsDraft(supabase,user.id,draftId,signal),enabled:Boolean(draftId),gcTime:0});
  const sport = initialActivitySport(search.get('sport'));
  const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  async function save(payload) {
    const activityId = draftId ? await finalizeGpsDraft(supabase,draftId,payload.activity.note || '') : null;
    if (!draftId) await saveActivity(supabase, user.id, payload);
    await Promise.all([
      cache.invalidateQueries({ queryKey: queryKeys.activitiesRoot(user.id) }),
      cache.invalidateQueries({ queryKey: queryKeys.dashboardRoot(user.id) }),
      cache.invalidateQueries({ queryKey: queryKeys.gpsDraftsRoot(user.id) }),
      cache.invalidateQueries({ queryKey: queryKeys.attachmentChoices(user.id) }),
      cache.invalidateQueries({ queryKey: queryKeys.memberRoot(user.id) }),
    ]);
    navigate(activityId ? `/activities/${activityId}` : '/home', { state: { performedOn: payload.activity.performed_on } });
  }
  if (draftId && draft.isPending) return <p role="status">보관한 GPS 측정을 불러오는 중…</p>;
  if (draftId && (draft.isError || !draft.data)) return <div role="alert"><p>보관한 측정을 불러오지 못했어요.</p><button onClick={()=>draft.refetch()}>다시 시도</button> <Link to="/activities">기록 목록으로</Link></div>;
  if (draftId && draft.data.finalized_at) return <div><p>이미 운동 기록으로 저장한 측정이에요.</p>{draft.data.activity_id && <Link to={`/activities/${draft.data.activity_id}`}>저장한 기록 보기</Link>} <Link to="/activities">기록 목록으로</Link></div>;
  return <ActivityForm {...exerciseNames} key={draftId || sport} initialSport={sport} today={today} cancelTo={returnTo || '/activities'} onSave={save}
    gpsDraft={draftId ? draft.data : null} initialValues={draftId ? activityFormValues({activity:draft.data,sets:[]}) : undefined}
    onSelectDraft={id=>setSearch({gpsDraft:id})} onClearDraft={()=>setSearch({sport:draft.data.sport})} />;
}
