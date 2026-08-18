'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { onAuthStateChange } from '@/lib/auth';
import { authKeys } from './useAuth';

export function useAuthStateSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (user) => {
      if (user) {
        // Trigger a refetch of user data
        await queryClient.invalidateQueries({ 
          queryKey: authKeys.user() 
        });
      } else {
        // Clear user data
        queryClient.setQueryData(authKeys.user(), null);
      }
    });

    return unsubscribe;
  }, [queryClient]);
}
