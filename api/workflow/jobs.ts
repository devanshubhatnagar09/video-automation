// Shared jobs storage for Vercel serverless functions
// Note: This is in-memory and will reset on cold starts
// For production, use Redis/Upstash/DB

interface JobStatus {
  status: 'running' | 'completed' | 'error'
  step: string
  message?: string
  data?: Record<string, unknown>
  error?: string
  logs: Array<{
    type: string
    step: string
    message: string
    data?: unknown
    timestamp: string
  }>
  createdAt: string
}

const jobs = new Map<string, JobStatus>()

export function getJob(jobId: string): JobStatus | undefined {
  return jobs.get(jobId)
}

export function setJob(jobId: string, job: JobStatus): void {
  jobs.set(jobId, job)
}

export function updateJob(jobId: string, updates: Partial<JobStatus>): void {
  const job = jobs.get(jobId)
  if (job) {
    jobs.set(jobId, { ...job, ...updates })
  }
}

export function getAllJobs(): Map<string, JobStatus> {
  return jobs
}

export { jobs }
