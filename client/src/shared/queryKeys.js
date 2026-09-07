// D-13: Query 키는 여기서만 만든다. 사용자 범위 데이터는 userId를 키에 포함.
export const queryKeys = {
  me: (userId) => ['me', userId],
  activities: (userId, filters = {}) => ['activities', userId, filters],
  meals: (userId, date) => ['meals', userId, date],
  goals: (userId) => ['goals', userId],
  feedback: (userId, period, date) => ['feedback', userId, period, date],
  dashboard: (userId, period) => ['dashboard', userId, period],
  crews: (filters = {}) => ['crews', filters],
  crew: (crewId) => ['crew', crewId],
  feed: (scope, crewId = null) => ['feed', scope, crewId],
  user: (userId) => ['user', userId],
};
