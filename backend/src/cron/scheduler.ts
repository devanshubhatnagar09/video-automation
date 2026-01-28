import cron from 'node-cron'

// Store the current cron job
let currentJob: cron.ScheduledTask | null = null

// Initialize cron jobs
export function initCronJobs() {
  console.log('📅 Cron scheduler initialized')
  
  // Default: Run at 9:00 AM every day
  // This can be updated via the API
  scheduleDailyJob('09:00')
}

// Schedule a daily job at a specific time
export function scheduleDailyJob(time: string) {
  // Cancel existing job if any
  if (currentJob) {
    currentJob.stop()
    currentJob = null
  }

  const [hours, minutes] = time.split(':').map(Number)
  
  // Cron expression: minute hour * * * (every day at specified time)
  const cronExpression = `${minutes} ${hours} * * *`
  
  currentJob = cron.schedule(cronExpression, async () => {
    console.log(`🎬 Daily video generation triggered at ${new Date().toISOString()}`)
    
    try {
      // Trigger the workflow via internal API call
      const apiKey = process.env.GEMINI_API_KEY
      
      if (!apiKey) {
        console.error('❌ No GEMINI_API_KEY set for cron job')
        return
      }

      const baseUrl = process.env.BASE_URL || 'http://localhost:3001'
      
      const response = await fetch(`${baseUrl}/api/workflow/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geminiApiKey: apiKey })
      })

      const result = await response.json()
      console.log('✅ Cron workflow result:', result)
    } catch (error) {
      console.error('❌ Cron workflow error:', error)
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Kolkata' // Indian timezone, adjust as needed
  })

  console.log(`📅 Daily job scheduled for ${time}`)
}

// Stop all cron jobs
export function stopCronJobs() {
  if (currentJob) {
    currentJob.stop()
    currentJob = null
    console.log('🛑 Cron jobs stopped')
  }
}

// Update cron schedule
export function updateCronSchedule(time: string, enabled: boolean) {
  if (enabled) {
    scheduleDailyJob(time)
  } else {
    stopCronJobs()
  }
}
