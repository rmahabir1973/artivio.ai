import { useCallback } from 'react';
import { queryClient } from '@/lib/queryClient';

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
  const markStepComplete = useCallback(async (step: OnboardingStep) => {
    try {
      // Check if step is already complete to prevent redundant API calls
      const cachedData = queryClient.getQueryData<OnboardingProgress>(['/api/onboarding']);
      
      if (cachedData && cachedData[step]) {
        // Step already complete, skip API call
        return;
      }

      const response = await fetch('/api/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ [step]: true }),
      });

      if (!response.ok) {
        console.error(`Failed to mark ${step} complete:`, await response.text());
        return;
      }

      // Invalidate cache to refresh UI
      await queryClient.invalidateQueries({ queryKey: ['/api/onboarding'] });
    } catch (error) {
      console.error(`Error marking ${step} complete:`, error);
    }
  }, []);

  return { markStepComplete };
}
