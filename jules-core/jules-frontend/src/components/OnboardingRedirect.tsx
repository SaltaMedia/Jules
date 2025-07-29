'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';
import { onboarding } from '@/lib/api';

interface OnboardingRedirectProps {
  children: React.ReactNode;
}

export default function OnboardingRedirect({ children }: OnboardingRedirectProps) {
  const [loading, setLoading] = useState(true);
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setLoading(false);
          return;
        }

        const decoded: { userId: string } = jwtDecode(token);
        const userId = decoded.userId;

        if (!userId) {
          setLoading(false);
          return;
        }

        const response = await onboarding.getOnboardingStatus(userId);
        
        if (!response.isOnboarded) {
          setShouldRedirect(true);
          setRedirectTo('/onboarding');
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
      } finally {
        setLoading(false);
      }
    };

    checkOnboardingStatus();
  }, []);

  useEffect(() => {
    if (shouldRedirect && redirectTo) {
      router.push(redirectTo);
    }
  }, [shouldRedirect, redirectTo, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-white to-gray-200">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
} 