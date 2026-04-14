import { supabase } from './supabase'

/**
 * Delete a job's uploaded file from Supabase Storage.
 * Must be called on BOTH 'delivered' AND 'cancelled' status transitions.
 * This keeps storage near zero on the Supabase free tier.
 *
 * @param {string} jobId - UUID of the job
 */
export async function deleteJobFile(jobId) {
  const { data: job, error } = await supabase
    .from('jobs')
    .select('file_path')
    .eq('id', jobId)
    .single()

  if (error || !job?.file_path) return

  await supabase.storage
    .from('job-files')
    .remove([job.file_path])
}
