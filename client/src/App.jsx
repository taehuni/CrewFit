import { Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './shared/queryClient.js';
import AppShell from './shared/AppShell.jsx';
import ComingSoon from './shared/ComingSoon.jsx';
import {
  AuthProvider, RequireAuth, GuestOnly,
  LoginPage, SignupPage, ForgotPasswordPage, ResetPasswordPage,
} from './features/auth/index.js';
import HomePage from './features/dashboard/HomePage.jsx';
import { ActivitiesPage, ActivityCreatePage, ActivityDetailPage, ActivityEditPage, ExerciseNamesPage } from './features/activities/index.js';
import { MePage } from './features/profile/index.js';
import { LandingPage } from './features/landing/index.js';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* 공개: 소개 화면(회원은 /home으로) */}
            <Route path="/" element={<LandingPage />} />
            <Route element={<GuestOnly />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/forgot" element={<ForgotPasswordPage />} />
            </Route>
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* 회원: 셸 안 */}
            <Route element={<RequireAuth />}>
              <Route element={<AppShell />}>
                <Route path="/home" element={<HomePage />} />
                <Route path="/activities" element={<Suspense fallback={<p role="status">기록 화면을 불러오고 있어요.</p>}><ActivitiesPage /></Suspense>} />
                <Route path="/activities/new" element={<ActivityCreatePage />} />
                <Route path="/activities/exercises" element={<Suspense fallback={<p role="status">운동 이름을 불러오고 있어요.</p>}><ExerciseNamesPage /></Suspense>} />
                <Route path="/activities/:activityId" element={<ActivityDetailPage />} />
                <Route path="/activities/:activityId/edit" element={<ActivityEditPage />} />
                <Route path="/crews" element={<ComingSoon title="크루" step="③" />} />
                <Route path="/feed" element={<ComingSoon title="피드" step="④" />} />
                <Route path="/me" element={<MePage />} />
                <Route path="/users/:id" element={<ComingSoon title="회원" step="④" />} />
                <Route path="*" element={<ComingSoon title="없는 페이지" step="—" />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
