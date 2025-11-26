import { useCallback } from 'react';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';

type OnboardingStep = 'exploredWorkflows' | 'triedTemplate' | 'completedFirstGeneration';

type OnboardingProgress = {
  id: string;
  userId: string;
  exploredWorkflows: boolean;
  triedTemplate: boolean;
  completedFirstGeneration: boolean;
  dismissed: boolean;
  createdAt: string;
  updatedAt: string;
};

export function useOnboarding() {
  const { isAuthenticated } = useAuth();

  const markStepComplete = useCallback(async (step: OnboardingStep) => {
    // Skip API calls for unauthenticated guests
    if (!isAuthenticated) {
      return;
    }

    try {
      // Check if step is already complete to prevent redundant API calls
      const cachedData = queryClient.getQueryData<OnboardingProgress>(['/api/onboarding']);
      
      if (cachedData && cachedData[step]) {
        // Step already complete, skip API call
        return;
      }

      await apiRequest('PATCH', '/api/onboarding', { [step]: true });

      // Invalidate cache to refresh UI
      await queryClient.invalidateQueries({ queryKey: ['/api/onboarding'] });
    } catch (error) {
      console.error(`Error marking ${step} complete:`, error);
    }
  }, [isAuthenticated]);

  return { markStepComplete };
}
