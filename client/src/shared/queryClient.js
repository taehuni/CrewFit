import { QueryClient } from '@tanstack/react-query';

// D-13: 서버 데이터는 전부 여기. 로그아웃(SIGNED_OUT) 시 AuthContext가 clear() 호출.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});
