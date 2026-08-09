import { requireSupabase } from '@/lib/supabase/client';

export async function deleteHostPhoto({
  mediaItemId,
}: {
  mediaItemId: string;
}): Promise<{ mediaItemId: string; deletedAt: string }> {
  const client = requireSupabase();
  const maxAttempts = 5;
  const delayMs = 750;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const { data, error } = await (client as any).rpc('delete_host_media_item', {
      p_media_item_id: mediaItemId,
    });

    if (!error && data) {
      const result = data as {
        media_item_id: string;
        deleted_at: string;
      };

      return {
        mediaItemId: result.media_item_id,
        deletedAt: result.deleted_at,
      };
    }

    if (error?.code !== 'PGRST202' || attempt === maxAttempts) {
      throw error ?? new Error('Unable to delete photo.');
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error('Unable to delete photo.');
}
