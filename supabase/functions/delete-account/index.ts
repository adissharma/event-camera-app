import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
  throw new Error('Supabase function environment is missing required credentials.');
}

type AccountDeletionResult = {
  deleted?: boolean;
  storage_deletion_job_ids?: string[];
};

/**
 * Deletes the caller through the transactional SQL function, then consumes the
 * durable storage-cleanup jobs it produced. A storage failure never revives or
 * exposes the deleted account: the job remains retryable for a worker.
 */
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return Response.json({ error: 'method_not_allowed' }, { status: 405, headers: corsHeaders });
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization) {
    return Response.json({ error: 'authentication_required' }, { status: 401, headers: corsHeaders });
  }

  const caller = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) {
    return Response.json({ error: 'authentication_required' }, { status: 401, headers: corsHeaders });
  }

  const { data, error } = await caller.rpc('delete_my_account');
  if (error) {
    console.error('[delete-account] transactional deletion failed', error.code);
    return Response.json({ error: 'account_deletion_failed' }, { status: 500, headers: corsHeaders });
  }

  const result = (data ?? {}) as AccountDeletionResult;
  const jobIds = Array.isArray(result.storage_deletion_job_ids)
    ? result.storage_deletion_job_ids.filter((id): id is string => typeof id === 'string')
    : [];

  if (jobIds.length > 0) {
    const admin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: jobs, error: jobsError } = await admin
      .from('storage_deletion_jobs')
      .select('id, bucket, storage_path')
      .in('id', jobIds);

    if (jobsError) {
      console.error('[delete-account] could not load storage cleanup jobs', jobsError.code);
    } else {
      await Promise.all((jobs ?? []).map(async (job) => {
        const { error: removeError } = await admin.storage
          .from(job.bucket)
          .remove([job.storage_path]);

        if (removeError) {
          console.error('[delete-account] storage cleanup failed', job.id);
          await admin
            .from('storage_deletion_jobs')
            .update({ status: 'retrying', attempt_count: 1, error_code: 'account_delete_cleanup_failed' })
            .eq('id', job.id);
          return;
        }

        await admin
          .from('storage_deletion_jobs')
          .update({ status: 'completed', completed_at: new Date().toISOString(), error_code: null })
          .eq('id', job.id);
      }));
    }
  }

  return Response.json({ deleted: result.deleted === true }, { headers: corsHeaders });
});
