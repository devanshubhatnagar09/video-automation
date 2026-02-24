import { motion, AnimatePresence } from 'framer-motion'
import { useMemo, useState, useEffect, useRef } from 'react'
import { 
  Play, 
  Video, 
  Youtube, 
  Sparkles, 
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Terminal,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { startWorkflow, getWorkflowStatus, getJobLogs, LogEntry } from '../services/api'
import toast from 'react-hot-toast'

export default function Dashboard() {
  const { 
    youtubeConnected,
    isRunning,
    setIsRunning,
    currentSteps,
    updateStep,
    resetWorkflow,
    videoHistory,
    addVideoRecord
  } = useStore()
  
  const [isTriggering, setIsTriggering] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [showLogs, setShowLogs] = useState(true)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const pollingTimeoutRef = useRef<number | null>(null)
  const isPollingRef = useRef(false)

  // Auto-scroll logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs])

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingTimeoutRef.current) {
        window.clearTimeout(pollingTimeoutRef.current)
        pollingTimeoutRef.current = null
      }
      isPollingRef.current = false
    }
  }, [])

  // Calculate real metrics from video history
  const stats = useMemo(() => {
    const totalVideos = videoHistory.length
    const completedVideos = videoHistory.filter(v => v.status === 'completed').length
    const uploadedVideos = videoHistory.filter(v => v.status === 'completed' && v.youtubeUrl).length
    const failedVideos = videoHistory.filter(v => v.status === 'failed').length
    
    const successRate = totalVideos > 0 
      ? Math.round((completedVideos / totalVideos) * 100) 
      : 0
    
    return [
      { 
        label: 'Videos Generated', 
        value: totalVideos.toString(), 
        icon: Video, 
        color: 'from-blue-500 to-cyan-500' 
      },
      { 
        label: 'YouTube Uploads', 
        value: uploadedVideos.toString(), 
        icon: Youtube, 
        color: 'from-red-500 to-pink-500' 
      },
      { 
        label: 'Success Rate', 
        value: totalVideos > 0 ? `${successRate}%` : '0%', 
        icon: TrendingUp, 
        color: 'from-green-500 to-emerald-500' 
      },
      { 
        label: 'Failed', 
        value: failedVideos.toString(), 
        icon: Clock, 
        color: 'from-purple-500 to-violet-500' 
      },
    ]
  }, [videoHistory])

  const canTrigger = !isRunning

  const handleTriggerWorkflow = async () => {
    if (!canTrigger) {
      return
    }

    // Stop any existing polling
    isPollingRef.current = false
    if (pollingTimeoutRef.current) {
      window.clearTimeout(pollingTimeoutRef.current)
      pollingTimeoutRef.current = null
    }

    setIsTriggering(true)
    setIsRunning(true)
    resetWorkflow()
    setLogs([])
    setShowLogs(true)

    try {
      const { jobId } = await startWorkflow()
      toast.success('Workflow started!')

      // Poll for status and logs
      isPollingRef.current = true
      
      // Small delay before first poll to ensure job is initialized
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const pollStatus = async () => {
        // Stop polling if flag is false
        if (!isPollingRef.current) {
          return
        }

        try {
          const status = await getWorkflowStatus(jobId)
          
          // Update current step
          const stepOrder = ['idea', 'prompt', 'video', 'upload']
          const currentStepIndex = stepOrder.indexOf(status.step)
          
          // Mark previous steps as completed
          stepOrder.forEach((step, index) => {
            if (index < currentStepIndex) {
              updateStep(step, { status: 'completed' })
            } else if (index === currentStepIndex) {
              updateStep(step, { 
                status: status.status === 'error' ? 'error' : (status.status === 'completed' && step === 'upload' ? 'completed' : 'running'),
                message: status.message 
              })
            }
          })

          // Fetch logs
          const logsResponse = await getJobLogs(jobId)
          setLogs(logsResponse.logs)

          if (status.status === 'completed') {
            // Stop polling
            isPollingRef.current = false
            if (pollingTimeoutRef.current) {
              window.clearTimeout(pollingTimeoutRef.current)
              pollingTimeoutRef.current = null
            }
            
            // Mark all steps as completed
            stepOrder.forEach(step => updateStep(step, { status: 'completed' }))
            
            // Save to history
            const content = status.data?.content as { title?: string; script?: string; imagePrompt?: string; hook?: string; tags?: string[] } | undefined
            if (content) {
              addVideoRecord({
                id: jobId,
                title: content.title || 'Untitled Video',
                description: `${content.hook || ''}\n\n${content.tags?.join(' ') || ''}`,
                script: content.script || '',
                imagePrompt: content.imagePrompt || '',
                videoPath: status.data?.videoPath as string,
                youtubeUrl: status.data?.youtubeUrl as string,
                status: status.data?.uploadSuccess ? 'completed' : 'completed',
                createdAt: new Date().toISOString(),
                duration: status.data?.duration as number
              })
            }
            
            toast.success('Video created successfully!')
            setIsRunning(false)
            setIsTriggering(false)
          } else if (status.status === 'error') {
            // Stop polling
            isPollingRef.current = false
            if (pollingTimeoutRef.current) {
              window.clearTimeout(pollingTimeoutRef.current)
              pollingTimeoutRef.current = null
            }
            
            // Save failed record to history
            addVideoRecord({
              id: jobId,
              title: 'Failed Video',
              description: '',
              script: '',
              imagePrompt: '',
              status: 'failed',
              createdAt: new Date().toISOString(),
              error: status.message || 'Unknown error'
            })
            
            toast.error(status.message || 'Workflow failed')
            setIsRunning(false)
            setIsTriggering(false)
          } else {
            // Continue polling only if flag is still true
            if (isPollingRef.current) {
              pollingTimeoutRef.current = window.setTimeout(pollStatus, 1500) as unknown as number
            }
          }
        } catch (err: any) {
          console.error('Poll error:', err)
          
          // Handle "Job not found" - might be cold start, wait and retry
          if (err?.response?.status === 404 || err?.response?.data?.error === 'Job not found') {
            console.log('Job not found, might be cold start. Retrying...')
            // Continue polling with longer delay
            if (isPollingRef.current) {
              pollingTimeoutRef.current = window.setTimeout(pollStatus, 3000) as unknown as number
            }
            return
          }
          
          // Continue polling only if flag is still true
          if (isPollingRef.current) {
            pollingTimeoutRef.current = window.setTimeout(pollStatus, 2000) as unknown as number
          }
        }
      }

      pollStatus()
    } catch (error) {
      toast.error('Failed to start workflow')
      setIsRunning(false)
      setIsTriggering(false)
    }
  }

  const getLogTypeColor = (type: string) => {
    switch (type) {
      case 'input': return 'text-blue-400'
      case 'output': return 'text-green-400'
      case 'error': return 'text-red-400'
      case 'step': return 'text-purple-400'
      default: return 'text-gray-400'
    }
  }

  const getLogTypeIcon = (type: string) => {
    switch (type) {
      case 'input': return '📤'
      case 'output': return '📥'
      case 'error': return '❌'
      case 'step': return '🔄'
      default: return 'ℹ️'
    }
  }

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-5 h-5 text-green-400" />
      case 'running': return <Loader2 className="w-5 h-5 text-primary-400 animate-spin" />
      case 'error': return <AlertCircle className="w-5 h-5 text-red-400" />
      default: return <div className="w-5 h-5 rounded-full border-2 border-gray-600" />
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-4xl font-bold"
          >
            <span className="gradient-text">Dashboard</span>
          </motion.h1>
          <p className="text-gray-400 mt-2">Monitor and control your video automation pipeline</p>
        </div>

        {/* Trigger Button */}
        <motion.button
          whileHover={{ scale: canTrigger ? 1.05 : 1 }}
          whileTap={{ scale: canTrigger ? 0.95 : 1 }}
          onClick={handleTriggerWorkflow}
          disabled={!canTrigger || isTriggering}
          className={`
            flex items-center gap-3 px-8 py-4 rounded-2xl font-semibold text-lg
            transition-all duration-300
            ${canTrigger 
              ? 'animated-gradient text-white glow cursor-pointer' 
              : 'bg-gray-800 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          {isTriggering ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <Play className="w-6 h-6" />
          )}
          {isTriggering ? 'Generating...' : 'Generate Video'}
        </motion.button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="glass-card rounded-2xl p-6 hover:border-white/20 transition-all duration-300 group"
          >
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
              <stat.icon className="w-6 h-6 text-white" />
            </div>
            <p className="text-3xl font-bold text-white">{stat.value}</p>
            <p className="text-gray-400 text-sm mt-1">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Logs Section */}
      <AnimatePresence>
        {(logs.length > 0 || isRunning) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card rounded-2xl overflow-hidden"
          >
            {/* Logs Header */}
            <div 
              className="flex items-center justify-between p-4 border-b border-white/10 cursor-pointer hover:bg-white/5"
              onClick={() => setShowLogs(!showLogs)}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                  <Terminal className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Live Logs</h2>
                  <p className="text-xs text-gray-400">Real-time LLM input/output</p>
                </div>
                {isRunning && (
                  <div className="flex items-center gap-2 ml-4">
                    <div className="w-2 h-2 rounded-full bg-green-400 pulse-dot" />
                    <span className="text-xs text-green-400">Running</span>
                  </div>
                )}
              </div>
              {showLogs ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </div>

            {/* Logs Content */}
            <AnimatePresence>
              {showLogs && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="max-h-96 overflow-y-auto p-4 font-mono text-sm bg-black/30">
                    {logs.length === 0 ? (
                      <div className="text-gray-500 text-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                        <p>Waiting for logs...</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {logs.map((log, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="border-l-2 border-white/10 pl-3"
                          >
                            <div className="flex items-start gap-2">
                              <span className="text-lg">{getLogTypeIcon(log.type)}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`font-semibold ${getLogTypeColor(log.type)}`}>
                                    [{log.type.toUpperCase()}]
                                  </span>
                                  <span className="text-purple-400">[{log.step}]</span>
                                  <span className="text-gray-500 text-xs">
                                    {new Date(log.timestamp).toLocaleTimeString()}
                                  </span>
                                </div>
                                <p className="text-gray-300 mt-1">{log.message}</p>
                                {(() => {
                                  const hasData = log.data !== undefined && log.data !== null;
                                  return hasData ? (
                                    <details className="mt-2">
                                      <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300">
                                        View data
                                      </summary>
                                      <pre className="mt-2 p-2 bg-black/50 rounded text-xs text-gray-400 overflow-x-auto max-h-48 overflow-y-auto">
                                        {JSON.stringify(log.data as Record<string, unknown>, null, 2)}
                                      </pre>
                                    </details>
                                  ) : null;
                                })()}
                              </div>
                            </div>
                          </motion.div>
                        ))}
                        <div ref={logsEndRef} />
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Workflow Status */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card rounded-2xl p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Current Workflow</h2>
              <p className="text-sm text-gray-400">Real-time pipeline status</p>
            </div>
          </div>

          <div className="space-y-4">
            {currentSteps.map((step, index) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className={`flex items-center gap-4 p-4 rounded-xl transition-all duration-300 ${
                  step.status === 'running' 
                    ? 'bg-primary-500/10 border border-primary-500/30' 
                    : step.status === 'completed'
                    ? 'bg-green-500/10 border border-green-500/30'
                    : step.status === 'error'
                    ? 'bg-red-500/10 border border-red-500/30'
                    : 'bg-white/5 border border-white/5'
                }`}
              >
                {getStepIcon(step.status)}
                <div className="flex-1">
                  <p className="font-medium">{step.name}</p>
                  {step.message && (
                    <p className="text-sm text-gray-400 mt-0.5">{step.message}</p>
                  )}
                </div>
                {step.status === 'running' && (
                  <div className="w-2 h-2 rounded-full bg-primary-400 pulse-dot" />
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                <Youtube className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Recent Videos</h2>
                <p className="text-sm text-gray-400">Latest generated content</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {videoHistory.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Video className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No videos generated yet</p>
                <p className="text-sm mt-1">Click "Generate Video" to start</p>
              </div>
            ) : (
              videoHistory.slice(0, 4).map((video, index) => (
                <motion.div
                  key={video.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                  className="flex items-center gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-300 cursor-pointer group"
                >
                  <div className="w-16 h-12 rounded-lg bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                    <Video className="w-6 h-6 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{video.title}</p>
                    <p className="text-sm text-gray-400 truncate">{video.description || video.script}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    video.status === 'completed' 
                      ? 'bg-green-500/20 text-green-400'
                      : video.status === 'failed'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {video.status}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Quick Setup Notice */}
      {!youtubeConnected && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-card rounded-2xl p-6 border-yellow-500/30"
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h3 className="font-semibold text-yellow-400">Setup Required</h3>
              <p className="text-gray-400 mt-1">
                To start generating videos, please complete the following:
              </p>
              <ul className="mt-3 space-y-2">
                {!youtubeConnected && (
                  <li className="flex items-center gap-2 text-sm text-gray-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                    Connect your YouTube account in Settings
                  </li>
                )}
              </ul>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
