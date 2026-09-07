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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<GuestOnly />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/forgot" element={<ForgotPasswordPage />} />
            </Route>
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            <Route element={<RequireAuth />}>
              <Route element={<AppShell />}>
                <Route index element={<HomePage />} />
                <Route path="/activities" element={<ComingSoon title="기록" step="②" />} />
                <Route path="/crews" element={<ComingSoon title="크루" step="③" />} />
                <Route path="/feed" element={<ComingSoon title="피드" step="④" />} />
                <Route path="/me" element={<ComingSoon title="나" step="④" />} />
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
