import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import {
  Video,
  Youtube,
  ExternalLink,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Search,
  Filter,
  ChevronDown,
  Sparkles,
  Eye,
  Trash2,
  FileText,
  Mic
} from 'lucide-react'
import { useStore, VideoRecord } from '../store/useStore'
import toast from 'react-hot-toast'

export default function History() {
  const { videoHistory, clearHistory } = useStore()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedVideo, setSelectedVideo] = useState<VideoRecord | null>(null)

  const filteredVideos = videoHistory.filter((video) => {
    const matchesSearch = video.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      video.script?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || video.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
            <CheckCircle2 className="w-3 h-3" />
            Completed
          </span>
        )
      case 'failed':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-medium">
            <XCircle className="w-3 h-3" />
            Failed
          </span>
        )
      case 'generating':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-medium">
            <Loader2 className="w-3 h-3 animate-spin" />
            Generating
          </span>
        )
      case 'uploading':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-medium">
            <Loader2 className="w-3 h-3 animate-spin" />
            Uploading
          </span>
        )
      default:
        return null
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return 'Unknown date'
    }
  }

  const handleClearHistory = () => {
    if (confirm('Are you sure you want to clear all history?')) {
      clearHistory()
      toast.success('History cleared')
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
            <span className="gradient-text">Video History</span>
          </motion.h1>
          <p className="text-gray-400 mt-2">Track all your generated videos and their status</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Video className="w-4 h-4" />
            <span>{videoHistory.length} videos generated</span>
          </div>
          
          {videoHistory.length > 0 && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleClearHistory}
              className="px-4 py-2 rounded-xl glass-card hover:bg-red-500/20 transition-colors flex items-center gap-2 text-red-400"
            >
              <Trash2 className="w-4 h-4" />
              Clear All
            </motion.button>
          )}
        </div>
      </div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex items-center gap-4"
      >
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search videos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50 focus:ring-2 focus:ring-primary-500/20 transition-all"
          />
        </div>

        {/* Status Filter */}
        <div className="relative">
          <div className="flex items-center gap-2 px-4 py-3 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-white appearance-none cursor-pointer focus:outline-none pr-6"
            >
              <option value="all" className="bg-gray-900">All Status</option>
              <option value="completed" className="bg-gray-900">Completed</option>
              <option value="generating" className="bg-gray-900">Generating</option>
              <option value="uploading" className="bg-gray-900">Uploading</option>
              <option value="failed" className="bg-gray-900">Failed</option>
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-4" />
          </div>
        </div>
      </motion.div>

      {/* Video Grid */}
      {filteredVideos.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredVideos.map((video, index) => (
              <motion.div
                key={video.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => setSelectedVideo(video)}
                className="glass-card rounded-2xl overflow-hidden cursor-pointer group hover:border-white/20 transition-all duration-300"
              >
                {/* Thumbnail */}
                <div className="relative h-40 bg-gradient-to-br from-gray-800 to-gray-900 overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${
                      video.status === 'completed' ? 'from-green-500 to-emerald-500' :
                      video.status === 'failed' ? 'from-red-500 to-pink-500' :
                      'from-primary-500 to-accent-500'
                    } flex items-center justify-center group-hover:scale-110 transition-transform`}>
                      <Video className="w-8 h-8 text-white" />
                    </div>
                  </div>
                  
                  {/* Duration Badge */}
                  {video.duration && (
                    <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/70 rounded text-xs text-white">
                      {video.duration.toFixed(1)}s
                    </div>
                  )}
                  
                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="flex items-center gap-2 text-white">
                      <Eye className="w-5 h-5" />
                      <span className="font-medium">View Details</span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="absolute top-3 right-3">
                    {getStatusBadge(video.status)}
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="font-semibold text-lg truncate">{video.title}</h3>
                  <p className="text-gray-400 text-sm mt-1 line-clamp-2">{video.script}</p>

                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{formatDate(video.createdAt)}</span>
                    </div>

                    {video.youtubeUrl && !video.youtubeUrl.includes('FAILED') && !video.youtubeUrl.includes('NO_VIDEO') && (
                      <a
                        href={video.youtubeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"
                      >
                        <Youtube className="w-3.5 h-3.5" />
                        <span>Watch</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        /* Empty State */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-20"
        >
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500/20 to-accent-500/20 flex items-center justify-center mx-auto mb-4">
            <Video className="w-10 h-10 text-gray-500" />
          </div>
          <h3 className="text-xl font-semibold text-gray-300">No Videos Yet</h3>
          <p className="text-gray-500 mt-2">
            Generated videos will appear here. Start by clicking "Generate Video" on the dashboard.
          </p>
        </motion.div>
      )}

      {/* Video Detail Modal */}
      <AnimatePresence>
        {selectedVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedVideo(null)}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold">{selectedVideo.title}</h2>
                  <div className="flex items-center gap-3 mt-2">
                    {getStatusBadge(selectedVideo.status)}
                    <span className="text-sm text-gray-400">
                      {formatDate(selectedVideo.createdAt)}
                    </span>
                    {selectedVideo.duration && (
                      <span className="text-sm text-gray-400">
                        <Clock className="w-4 h-4 inline mr-1" />
                        {selectedVideo.duration.toFixed(1)}s
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedVideo(null)}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <XCircle className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              {/* Video Preview Placeholder */}
              <div className="relative h-64 bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl overflow-hidden mb-6">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                    <Video className="w-10 h-10 text-white" />
                  </div>
                </div>
                {selectedVideo.duration && (
                  <div className="absolute bottom-3 left-3 px-3 py-1 bg-black/70 rounded text-sm text-white">
                    Duration: {selectedVideo.duration.toFixed(1)} seconds
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="space-y-4">
                {selectedVideo.script && (
                  <div className="p-4 rounded-xl bg-white/5">
                    <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                      <Mic className="w-4 h-4" />
                      <span>Voiceover Script</span>
                    </div>
                    <p className="text-gray-200">{selectedVideo.script}</p>
                  </div>
                )}

                {selectedVideo.imagePrompt && (
                  <div className="p-4 rounded-xl bg-white/5">
                    <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                      <Sparkles className="w-4 h-4" />
                      <span>Image Prompt</span>
                    </div>
                    <p className="text-gray-300 text-sm">{selectedVideo.imagePrompt}</p>
                  </div>
                )}

                {selectedVideo.description && (
                  <div className="p-4 rounded-xl bg-white/5">
                    <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                      <FileText className="w-4 h-4" />
                      <span>Description</span>
                    </div>
                    <p className="text-gray-200 text-sm whitespace-pre-wrap">{selectedVideo.description}</p>
                  </div>
                )}

                {selectedVideo.error && (
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                    <div className="flex items-center gap-2 text-sm text-red-400 mb-2">
                      <XCircle className="w-4 h-4" />
                      <span>Error</span>
                    </div>
                    <p className="text-red-300">{selectedVideo.error}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              {selectedVideo.youtubeUrl && !selectedVideo.youtubeUrl.includes('FAILED') && !selectedVideo.youtubeUrl.includes('NO_VIDEO') && (
                <div className="mt-6 pt-6 border-t border-white/10">
                  <a
                    href={selectedVideo.youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-red-500 to-pink-500 text-white font-medium hover:opacity-90 transition-opacity"
                  >
                    <Youtube className="w-5 h-5" />
                    Watch on YouTube
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
