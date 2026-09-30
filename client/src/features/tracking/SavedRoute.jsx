import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/index.js';
import { supabase } from '../../shared/supabaseClient.js';
import { queryKeys } from '../../shared/queryKeys.js';
import { loadOwnRoute, loadPostRoute } from './routes.js';
import RouteMap from './RouteMap.jsx';
export default function SavedRoute({ activityId, postId }) {
  const { user } = useAuth();
  const route = useQuery({ queryKey: postId ? queryKeys.postRoute(user.id, String(postId)) : queryKeys.ownRoute(user.id, String(activityId)),
    queryFn: () => postId ? loadPostRoute(supabase, postId) : loadOwnRoute(supabase, user.id, activityId), retry: false, gcTime: 0, staleTime: 0 });
  if (route.isPending) return <p role="status">경로를 확인하고 있어요.</p>;
  if (route.isError) return <div role="alert"><p>경로를 불러오지 못했어요.</p><button className="btn btn-ghost" onClick={() => route.refetch()}>경로 다시 조회</button></div>;
  if (!route.data) return null;
  return <section><h2>GPS 경로</h2><RouteMap points={route.data.points} /></section>;
}
