"use client";
import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { jwtDecode } from 'jwt-decode';
import { onboarding } from '@/lib/api';

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (token) {
      // Store the JWT token
      localStorage.setItem('token', token);
      
      // Check onboarding status
      const checkOnboarding = async () => {
        try {
          const decoded: { userId: string } = jwtDecode(token);
          const userId = decoded.userId;
          
          if (userId) {
            const response = await onboarding.getOnboardingStatus(userId);
            if (response.isOnboarded) {
              router.push('/chat');
            } else {
              router.push('/onboarding');
            }
          } else {
            router.push('/chat');
          }
        } catch (error) {
          console.error('Error checking onboarding status:', error);
          router.push('/chat');
        }
      };
      
      checkOnboarding();
    } else if (error) {
      // Redirect to login with error
      router.push(`/login?error=${encodeURIComponent(error)}`);
    } else {
      // No token or error, redirect to login
      router.push('/login');
    }
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Completing sign in...</p>
      </div>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <AuthCallbackInner />
    </Suspense>
  );
} 