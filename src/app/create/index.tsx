import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useCreationDraft } from '@/features/celebrations/draft/store';

/**
 * Entry point for creation.
 * Always starts fresh — no draft resumption.
 */
export default function CreateEntryScreen() {
  const router = useRouter();
  const { isRestoring, reset } = useCreationDraft();

  useEffect(() => {
    if (isRestoring) return;
    // Always start fresh
    reset().then(() => {
      router.replace('/create/name');
    });
  }, [isRestoring, router, reset]);

  // Loading state while resetting
  return null;
}
