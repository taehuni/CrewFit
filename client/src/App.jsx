import { Suspense, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './shared/queryClient.js';
import AppShell from './shared/AppShell.jsx';
import NotFoundPage from './shared/NotFoundPage.jsx';
import {
  AuthProvider, RequireAuth, GuestOnly,
  LoginPage, SignupPage, ForgotPasswordPage, ResetPasswordPage,
  VerifyEmailPage, AuthCallbackPage, initialAuthLink,
} from './features/auth/index.js';
import { HomePage } from './features/dashboard/index.js';
import { ActivitiesPage, ActivityCreatePage, ActivityDetailPage, ActivityEditPage, ExerciseNamesPage } from './features/activities/index.js';
import { MePage, MemberPage } from './features/profile/index.js';
import { LandingPage } from './features/landing/index.js';
import { GoalsPage } from './features/goals/index.js';
import { MealsPage, MealCreatePage, MealDetailPage, MealEditPage } from './features/meals/index.js';
import { FeedbackPage } from './features/feedback/index.js';
import { CrewsPage, CrewCreatePage, CrewDetailPage } from './features/crews/index.js';
import { FeedPage, PostEditor, PostDetail } from './features/feed/index.js';
import { TrackingPage } from './features/tracking/index.js';
import {NotificationsPage} from './features/social/index.js';

function AuthLinkEntry({ children }) {
  const { pathname } = useLocation();
  const pendingLink = useRef(initialAuthLink.present);
  useEffect(() => { if (pathname !== '/') pendingLink.current = false; }, [pathname]);
  const target = initialAuthLink.recovery ? '/reset-password' : '/auth/callback';
  // Older emails may return to Site URL (/). Preserve SDK ownership of token exchange.
  if (pathname === '/' && pendingLink.current) return <Navigate to={target + window.location.search + window.location.hash} replace />;
  return children;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AuthLinkEntry>
          <Suspense fallback={<p role="status">화면을 불러오고 있어요.</p>}>
          <Routes>
            {/* 공개: 소개 화면(회원은 /home으로) */}
            <Route path="/" element={<LandingPage />} />
            <Route element={<GuestOnly />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/forgot" element={<ForgotPasswordPage />} />
            </Route>
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />

            {/* 회원: 셸 안 */}
            <Route element={<RequireAuth />}>
              <Route path="/activities/track" element={<TrackingPage />} />
              <Route element={<AppShell />}>
                <Route path="/home" element={<HomePage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/goals" element={<GoalsPage />} />
                <Route path="/feedback" element={<FeedbackPage />} />
                <Route path="/activities" element={<ActivitiesPage />} />
                <Route path="/activities/new" element={<ActivityCreatePage />} />
                <Route path="/activities/exercises" element={<ExerciseNamesPage />} />
                <Route path="/activities/:activityId" element={<ActivityDetailPage />} />
                <Route path="/activities/:activityId/edit" element={<ActivityEditPage />} />
                <Route path="/meals" element={<MealsPage />} />
                <Route path="/meals/new" element={<MealCreatePage />} />
                <Route path="/meals/:mealId" element={<MealDetailPage />} />
                <Route path="/meals/:mealId/edit" element={<MealEditPage />} />
                <Route path="/crews" element={<CrewsPage />} />
                <Route path="/crews/new" element={<CrewCreatePage />} />
                <Route path="/crews/:crewId" element={<CrewDetailPage />} />
                <Route path="/feed" element={<FeedPage />} />
                <Route path="/feed/new" element={<PostEditor />} />
                <Route path="/feed/:postId" element={<PostDetail />} />
                <Route path="/feed/:postId/edit" element={<PostEditor />} />
                <Route path="/me" element={<MePage />} />
                <Route path="/users/:id" element={<MemberPage />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          </Suspense>
          </AuthLinkEntry>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
