import { motion } from 'framer-motion'
import {
  Lightbulb,
  FileText,
  Film,
  Upload,
  ArrowRight,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Sparkles,
  Play,
  Pause
} from 'lucide-react'
import { useStore } from '../store/useStore'

const workflowSteps = [
  {
    id: 'idea',
    icon: Lightbulb,
    title: 'Generate Video Idea',
    description: 'AI analyzes trends and generates a creative, engaging video concept',
    prompt: `You are a creative content strategist. Generate a unique, viral-worthy video idea that:
- Is attention-grabbing in the first 3 seconds
- Tells a compelling micro-story
- Has emotional impact
- Is suitable for a 15-60 second video
- Appeals to a broad audience

Provide: Title, Hook, Story Arc, Visual Style, and Target Emotion.`,
    color: 'from-yellow-500 to-orange-500',
    bgGlow: 'bg-yellow-500/20'
  },
  {
    id: 'prompt',
    icon: FileText,
    title: 'Create Video Prompt',
    description: 'Transforms the idea into a detailed prompt for video generation',
    prompt: `Based on the video idea, create a detailed Veo video generation prompt:

Structure:
- Scene description (environment, lighting, mood)
- Camera movement (pan, zoom, tracking)
- Subject details (appearance, actions, expressions)
- Style reference (cinematic, documentary, animated)
- Duration and pacing
- Audio/music suggestions

Make it specific enough for AI video generation.`,
    color: 'from-blue-500 to-cyan-500',
    bgGlow: 'bg-blue-500/20'
  },
  {
    id: 'video',
    icon: Film,
    title: 'Generate Video with Veo',
    description: 'Google Veo AI creates the video based on the crafted prompt',
    prompt: `The Veo API receives the prompt and generates:
- High-quality video output
- Smooth transitions and animations
- Consistent style throughout
- Professional-grade visuals

Processing time: 2-5 minutes depending on complexity.`,
    color: 'from-purple-500 to-pink-500',
    bgGlow: 'bg-purple-500/20'
  },
  {
    id: 'upload',
    icon: Upload,
    title: 'Upload to YouTube',
    description: 'Automatically uploads the generated video with optimized metadata',
    prompt: `YouTube upload includes:
- Auto-generated title and description
- Relevant tags for discoverability
- Custom thumbnail (optional)
- Scheduled or immediate publish
- Proper categorization

Video goes live on your connected channel.`,
    color: 'from-red-500 to-pink-500',
    bgGlow: 'bg-red-500/20'
  }
]

export default function Workflow() {
  const { currentSteps, isRunning } = useStore()

  const getStepStatus = (stepId: string) => {
    return currentSteps.find(s => s.id === stepId)?.status || 'pending'
  }

  const getStepMessage = (stepId: string) => {
    return currentSteps.find(s => s.id === stepId)?.message
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-6 h-6 text-green-400" />
      case 'running': return <Loader2 className="w-6 h-6 text-white animate-spin" />
      case 'error': return <AlertCircle className="w-6 h-6 text-red-400" />
      default: return null
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
            <span className="gradient-text">Workflow Pipeline</span>
          </motion.h1>
          <p className="text-gray-400 mt-2">Visualize the complete video generation process</p>
        </div>

        {isRunning && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-3 px-4 py-2 rounded-xl bg-primary-500/20 border border-primary-500/30"
          >
            <div className="w-2 h-2 rounded-full bg-primary-400 pulse-dot" />
            <span className="text-primary-400 font-medium">Pipeline Running</span>
          </motion.div>
        )}
      </div>

      {/* Workflow Visualization */}
      <div className="relative">
        {/* Connection Lines */}
        <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
          {[0, 1, 2].map((i) => {
            const startStatus = getStepStatus(workflowSteps[i].id)
            const isActive = startStatus === 'running' || startStatus === 'completed'
            return (
              <motion.line
                key={i}
                x1="50%"
                y1={`${12.5 + i * 25}%`}
                x2="50%"
                y2={`${37.5 + i * 25}%`}
                stroke={isActive ? 'url(#gradient)' : 'rgba(255,255,255,0.1)'}
                strokeWidth="2"
                strokeDasharray={isActive ? '0' : '8 4'}
                className={isActive ? 'flow-line' : ''}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.5, delay: i * 0.2 }}
              />
            )
          })}
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#0ea5e9" />
              <stop offset="100%" stopColor="#d946ef" />
            </linearGradient>
          </defs>
        </svg>

        {/* Workflow Steps */}
        <div className="relative z-10 space-y-8">
          {workflowSteps.map((step, index) => {
            const status = getStepStatus(step.id)
            const message = getStepMessage(step.id)
            const isActive = status === 'running'
            const isCompleted = status === 'completed'
            const isError = status === 'error'

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.15 }}
                className={`
                  relative glass-card rounded-2xl p-6 overflow-hidden
                  transition-all duration-500
                  ${isActive ? 'border-primary-500/50 glow' : ''}
                  ${isCompleted ? 'border-green-500/30' : ''}
                  ${isError ? 'border-red-500/30' : ''}
                `}
              >
                {/* Background Glow */}
                {isActive && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={`absolute inset-0 ${step.bgGlow} blur-3xl`}
                  />
                )}

                <div className="relative z-10">
                  <div className="flex items-start gap-6">
                    {/* Step Number & Icon */}
                    <div className="flex flex-col items-center gap-2">
                      <motion.div
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        className={`
                          w-16 h-16 rounded-2xl flex items-center justify-center
                          bg-gradient-to-br ${step.color}
                          ${isActive ? 'animate-pulse' : ''}
                        `}
                      >
                        <step.icon className="w-8 h-8 text-white" />
                      </motion.div>
                      <span className="text-xs text-gray-500 font-mono">STEP {index + 1}</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-semibold">{step.title}</h3>
                        {getStatusIcon(status)}
                      </div>
                      <p className="text-gray-400 mt-1">{step.description}</p>

                      {/* Status Message */}
                      {message && (
                        <motion.p
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`mt-2 text-sm ${
                            isError ? 'text-red-400' : 'text-primary-400'
                          }`}
                        >
                          {message}
                        </motion.p>
                      )}

                      {/* Expanded Prompt Details */}
                      <motion.div
                        initial={false}
                        animate={{ height: isActive ? 'auto' : 0, opacity: isActive ? 1 : 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 p-4 rounded-xl bg-black/30 border border-white/5">
                          <div className="flex items-center gap-2 mb-2 text-sm text-gray-400">
                            <Sparkles className="w-4 h-4" />
                            <span>AI Prompt Template</span>
                          </div>
                          <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                            {step.prompt}
                          </pre>
                        </div>
                      </motion.div>
                    </div>

                    {/* Status Indicator */}
                    <div className="flex flex-col items-center gap-2">
                      {isActive && (
                        <motion.div
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ repeat: Infinity, duration: 2 }}
                          className="w-3 h-3 rounded-full bg-primary-400"
                        />
                      )}
                      {isCompleted && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-3 h-3 rounded-full bg-green-400"
                        />
                      )}
                      {isError && (
                        <div className="w-3 h-3 rounded-full bg-red-400" />
                      )}
                      {status === 'pending' && (
                        <div className="w-3 h-3 rounded-full bg-gray-600" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Arrow to Next Step */}
                {index < workflowSteps.length - 1 && (
                  <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 z-20">
                    <motion.div
                      animate={isCompleted ? { y: [0, 5, 0] } : {}}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                    >
                      <ArrowRight 
                        className={`w-6 h-6 rotate-90 ${
                          isCompleted ? 'text-green-400' : 'text-gray-600'
                        }`}
                      />
                    </motion.div>
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="flex items-center justify-center gap-8 text-sm"
      >
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gray-600" />
          <span className="text-gray-400">Pending</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-primary-400 pulse-dot" />
          <span className="text-gray-400">Running</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-400" />
          <span className="text-gray-400">Completed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <span className="text-gray-400">Error</span>
        </div>
      </motion.div>

      {/* Info Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="glass-card rounded-2xl p-6"
      >
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold">How the Pipeline Works</h3>
            <p className="text-gray-400 mt-2 leading-relaxed">
              The video generation pipeline is fully automated. Starting with AI-powered idea generation,
              it creates unique video concepts tailored for viral potential. The idea is then transformed
              into a detailed prompt for Google's Veo AI, which generates high-quality video content.
              Finally, the video is automatically uploaded to your connected YouTube channel with
              optimized metadata for maximum discoverability.
            </p>
            <div className="flex items-center gap-4 mt-4">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Play className="w-4 h-4" />
                <span>Triggered manually or via cron</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Pause className="w-4 h-4" />
                <span>~5 minutes total processing</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
