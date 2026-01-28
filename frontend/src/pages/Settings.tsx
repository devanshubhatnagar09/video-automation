import { motion } from 'framer-motion'
import { useState } from 'react'
import {
  Key,
  Youtube,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  Clock,
  Bell,
  ExternalLink,
  Shield
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { verifyGeminiKey, getYoutubeAuthUrl } from '../services/api'
import toast from 'react-hot-toast'

export default function Settings() {
  const {
    geminiApiKey,
    setGeminiApiKey,
    youtubeConnected,
    youtubeChannel,
    setYoutubeConnected,
    cronEnabled,
    setCronEnabled,
    cronTime,
    setCronTime
  } = useStore()

  const [apiKeyInput, setApiKeyInput] = useState(geminiApiKey)
  const [showApiKey, setShowApiKey] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isConnectingYoutube, setIsConnectingYoutube] = useState(false)

  const handleVerifyGemini = async () => {
    if (!apiKeyInput.trim()) {
      toast.error('Please enter an API key')
      return
    }

    setIsVerifying(true)
    try {
      const result = await verifyGeminiKey(apiKeyInput)
      if (result.valid) {
        setGeminiApiKey(apiKeyInput)
        toast.success('Gemini API key verified and saved!')
      } else {
        toast.error(result.error || 'Invalid API key')
      }
    } catch {
      toast.error('Failed to verify API key')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleConnectYoutube = async () => {
    setIsConnectingYoutube(true)
    try {
      const { url } = await getYoutubeAuthUrl()
      // Open YouTube auth in new window
      const authWindow = window.open(url, 'youtube-auth', 'width=600,height=700')
      
      // Listen for callback
      const handleMessage = (event: MessageEvent) => {
        if (event.data.type === 'youtube-auth-success') {
          setYoutubeConnected(true, event.data.channel)
          toast.success(`Connected to YouTube: ${event.data.channel}`)
          window.removeEventListener('message', handleMessage)
          authWindow?.close()
        } else if (event.data.type === 'youtube-auth-error') {
          toast.error(event.data.error || 'Failed to connect YouTube')
          window.removeEventListener('message', handleMessage)
        }
      }
      
      window.addEventListener('message', handleMessage)
      setIsConnectingYoutube(false)
    } catch {
      toast.error('Failed to start YouTube authentication')
      setIsConnectingYoutube(false)
    }
  }

  const handleDisconnectYoutube = () => {
    setYoutubeConnected(false)
    toast.success('YouTube disconnected')
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <motion.h1
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-4xl font-bold"
        >
          <span className="gradient-text">Settings</span>
        </motion.h1>
        <p className="text-gray-400 mt-2">Configure your API keys and automation preferences</p>
      </div>

      {/* Gemini API Key */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card rounded-2xl p-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
            <Key className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Gemini API Key</h2>
            <p className="text-sm text-gray-400">Required for AI-powered video generation</p>
          </div>
          {geminiApiKey && (
            <div className="ml-auto flex items-center gap-2 text-green-400">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm">Connected</span>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="Enter your Gemini API key..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-24 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50 focus:ring-2 focus:ring-primary-500/20 transition-all"
            />
            <button
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-white transition-colors"
            >
              {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          <div className="flex items-center gap-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleVerifyGemini}
              disabled={isVerifying}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-primary-500 to-accent-500 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isVerifying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Shield className="w-4 h-4" />
              )}
              {isVerifying ? 'Verifying...' : 'Verify & Save'}
            </motion.button>

            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-primary-400 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Get API Key from Google AI Studio
            </a>
          </div>
        </div>
      </motion.div>

      {/* YouTube Connection */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card rounded-2xl p-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center">
            <Youtube className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">YouTube Account</h2>
            <p className="text-sm text-gray-400">Connect to upload videos automatically</p>
          </div>
          {youtubeConnected && (
            <div className="ml-auto flex items-center gap-2 text-green-400">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm">Connected</span>
            </div>
          )}
        </div>

        {youtubeConnected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-green-500/30">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center">
                <Youtube className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-medium">{youtubeChannel || 'YouTube Channel'}</p>
                <p className="text-sm text-green-400">Connected and ready to upload</p>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleDisconnectYoutube}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-500/50 text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <XCircle className="w-4 h-4" />
                Disconnect
              </motion.button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-400">
              Connect your YouTube account to automatically upload generated videos.
              We only request the minimum permissions needed to upload videos.
            </p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleConnectYoutube}
              disabled={isConnectingYoutube}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-red-500 to-pink-500 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isConnectingYoutube ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Youtube className="w-5 h-5" />
              )}
              {isConnectingYoutube ? 'Connecting...' : 'Connect YouTube Account'}
            </motion.button>
          </div>
        )}
      </motion.div>

      {/* Cron Settings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card rounded-2xl p-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center">
            <Clock className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Scheduled Generation</h2>
            <p className="text-sm text-gray-400">Automatically generate videos daily</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/5">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-gray-400" />
              <div>
                <p className="font-medium">Daily Auto-Generation</p>
                <p className="text-sm text-gray-400">Generate and upload a new video every day</p>
              </div>
            </div>
            <button
              onClick={() => setCronEnabled(!cronEnabled)}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                cronEnabled ? 'bg-gradient-to-r from-primary-500 to-accent-500' : 'bg-gray-700'
              }`}
            >
              <motion.div
                initial={false}
                animate={{ x: cronEnabled ? 28 : 4 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="absolute top-1 w-5 h-5 rounded-full bg-white shadow-lg"
              />
            </button>
          </div>

          {/* Time Picker */}
          {cronEnabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-4 p-4 rounded-xl bg-white/5"
            >
              <Clock className="w-5 h-5 text-gray-400" />
              <div className="flex-1">
                <p className="font-medium">Generation Time</p>
                <p className="text-sm text-gray-400">Videos will be generated at this time daily</p>
              </div>
              <input
                type="time"
                value={cronTime}
                onChange={(e) => setCronTime(e.target.value)}
                className="bg-white/10 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary-500/50"
              />
            </motion.div>
          )}

          {/* Status */}
          {cronEnabled && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <div className="w-2 h-2 rounded-full bg-green-400 pulse-dot" />
              <span>Next run: Tomorrow at {cronTime}</span>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
