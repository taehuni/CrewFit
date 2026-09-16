// D-13: Query 키는 여기서만 만든다. 사용자 범위 데이터는 userId를 키에 포함.
export const queryKeys = {
  me: (userId) => ['me', userId],
  activities: (userId, filters = {}) => ['activities', userId, filters],
  activityList: (userId, filters) => ['activities', userId, 'list', filters],
  exerciseNames: (userId) => ['activities', userId, 'exerciseNames'],
  activity: (userId, activityId) => ['activities', userId, 'detail', activityId],
  meals: (userId, date) => ['meals', userId, date],
  goals: (userId) => ['goals', userId],
  feedback: (userId, period, date) => ['feedback', userId, period, date],
  dashboard: (userId, period, date) => ['dashboard', userId, period, date],
  dashboardRoot: (userId) => ['dashboard', userId],
  activitiesRoot: (userId) => ['activities', userId],
  crews: (filters = {}) => ['crews', filters],
  crew: (crewId) => ['crew', crewId],
  feed: (scope, crewId = null) => ['feed', scope, crewId],
  user: (userId) => ['user', userId],
};
