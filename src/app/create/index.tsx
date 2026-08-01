import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useCreationDraft } from '@/features/celebrations/draft/store';

/**
 * Entry point for creation.
 * Always starts fresh — redirects immediately to first step with no blank screen.
 */
export default function CreateEntryScreen() {
  const router = useRouter();
  const { isRestoring, reset } = useCreationDraft();

  useEffect(() => {
    if (isRestoring) return;
    // Reset and navigate immediately without waiting
    void reset();
    router.replace('/create/name');
  }, [isRestoring, router, reset]);

  return null;
}
