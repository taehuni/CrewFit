import { lazy } from 'react';

// 기능 간 import는 여기서 export한 것만 (overview.md 3절 규칙 2)
export { AuthProvider, useAuth } from './AuthContext.jsx';
export { default as RequireAuth, GuestOnly } from './RequireAuth.jsx';
export const LoginPage = lazy(() => import('./LoginPage.jsx'));
export const SignupPage = lazy(() => import('./SignupPage.jsx'));
export const ForgotPasswordPage = lazy(() => import('./ForgotPasswordPage.jsx'));
export const ResetPasswordPage = lazy(() => import('./ResetPasswordPage.jsx'));
export const VerifyEmailPage = lazy(() => import('./VerifyEmailPage.jsx'));
export const AuthCallbackPage = lazy(() => import('./AuthCallbackPage.jsx'));
export { initialAuthLink } from './authLinks.js';
