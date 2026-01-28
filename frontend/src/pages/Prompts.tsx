import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  FileText, 
  Mic, 
  Palette, 
  Save, 
  RotateCcw,
  Sparkles,
  Info
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { updateVideoSettings } from '../services/api'
import toast from 'react-hot-toast'

export default function Prompts() {
  const { prompts, setPrompts } = useStore()
  const [localPrompts, setLocalPrompts] = useState(prompts)
  const [hasChanges, setHasChanges] = useState(false)

  const handleChange = (field: string, value: string) => {
    setLocalPrompts(prev => ({ ...prev, [field]: value }))
    setHasChanges(true)
  }

  const handleSave = async () => {
    setPrompts(localPrompts)
    setHasChanges(false)
    
    // Also update backend settings
    try {
      await updateVideoSettings({
        voice: localPrompts.defaultVoice,
        language: localPrompts.language
      })
      toast.success('Settings saved!')
    } catch (error) {
      console.error('Failed to update backend settings:', error)
      toast.success('Prompts saved locally!')
    }
  }

  const handleReset = () => {
    const defaultPrompt = `You are a viral YouTube Shorts content creator. Generate content for a short vertical video (15-30 seconds).

Create something that will grab attention - it could be:
- A fascinating fact
- A mind-blowing revelation  
- A funny observation
- An inspiring quote
- A useful life hack
- A surprising statistic

Provide your response in this EXACT JSON format (no markdown, just JSON):
{
  "title": "Catchy video title for YouTube (max 60 chars)",
  "hook": "Opening hook that grabs attention (1 sentence)",
  "script": "The voiceover narration script (30-50 words, punchy and engaging)",
  "imagePrompt": "Description of the background image (visual that matches the content, dramatic and eye-catching)",
  "tags": ["#Shorts", "tag2", "tag3", "tag4", "tag5"],
  "category": "Education/Entertainment/Motivation/Facts/Comedy"
}`
    setLocalPrompts({
      contentPrompt: defaultPrompt,
      defaultVoice: 'Samantha',
      defaultStyle: 'cinematic'
    })
    setHasChanges(true)
    toast.success('Reset to defaults')
  }

  const languages = [
    { id: 'english', name: 'English', flag: '🇺🇸' },
    { id: 'hindi', name: 'Hindi (हिंदी)', flag: '🇮🇳' },
  ]

  const voices = [
    { id: 'Jenny', name: 'Jenny (Female)', desc: 'Natural, friendly - Best for English', lang: 'english' },
    { id: 'Guy', name: 'Guy (Male)', desc: 'Professional, clear - English', lang: 'english' },
    { id: 'Aria', name: 'Aria (Female)', desc: 'Warm, expressive - English', lang: 'english' },
    { id: 'Swara', name: 'Swara (Female)', desc: 'Natural Hindi voice - हिंदी', lang: 'hindi' },
    { id: 'Madhur', name: 'Madhur (Male)', desc: 'Clear Hindi voice - हिंदी', lang: 'hindi' },
  ]

  const filteredVoices = voices.filter(v => v.lang === localPrompts.language)

  const styles = [
    { id: 'cinematic', name: 'Cinematic', desc: 'Dramatic, movie-like' },
    { id: 'minimal', name: 'Minimal', desc: 'Clean, simple' },
    { id: 'vibrant', name: 'Vibrant', desc: 'Colorful, energetic' },
    { id: 'dark', name: 'Dark', desc: 'Moody, mysterious' },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Prompts</h1>
          <p className="text-gray-400 mt-1">Customize how your videos are generated</p>
        </div>
        <div className="flex gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleReset}
            className="px-4 py-2 rounded-xl glass-card hover:bg-white/10 transition-colors flex items-center gap-2 text-gray-300"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSave}
            disabled={!hasChanges}
            className={`px-6 py-2 rounded-xl flex items-center gap-2 font-medium transition-all ${
              hasChanges 
                ? 'animated-gradient text-white glow' 
                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Save className="w-4 h-4" />
            Save Changes
          </motion.button>
        </div>
      </div>

      {/* Info Box */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-4 border border-blue-500/30 bg-blue-500/10"
      >
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-300">
            <p className="font-medium text-blue-400 mb-1">How Prompts Work</p>
            <p>The content prompt is sent to Gemini AI to generate video ideas. The response includes the title, script (for voiceover), and image description (for background). Customize this prompt to control what kind of content gets generated.</p>
          </div>
        </div>
      </motion.div>

      {/* Language Selector */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
            <span className="text-xl">🌐</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Language / भाषा</h3>
            <p className="text-sm text-gray-400">Select the language for video content</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {languages.map((lang) => (
            <label
              key={lang.id}
              className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all ${
                localPrompts.language === lang.id
                  ? 'bg-blue-500/20 border-2 border-blue-500'
                  : 'bg-dark-800/50 border-2 border-white/5 hover:border-white/20'
              }`}
            >
              <input
                type="radio"
                name="language"
                value={lang.id}
                checked={localPrompts.language === lang.id}
                onChange={(e) => {
                  handleChange('language', e.target.value)
                  // Auto-select appropriate voice
                  if (e.target.value === 'hindi') {
                    handleChange('defaultVoice', 'Swara')
                  } else {
                    handleChange('defaultVoice', 'Jenny')
                  }
                }}
                className="hidden"
              />
              <span className="text-3xl">{lang.flag}</span>
              <div>
                <p className="text-white font-semibold text-lg">{lang.name}</p>
                <p className="text-xs text-gray-400">
                  {lang.id === 'english' ? 'English content & voice' : 'हिंदी content & voice'}
                </p>
              </div>
              {localPrompts.language === lang.id && (
                <div className="ml-auto">
                  <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                    <span className="text-white text-sm">✓</span>
                  </div>
                </div>
              )}
            </label>
          ))}
        </div>
      </motion.div>

      {/* Main Content Prompt */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="glass-card p-6 space-y-4"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              Content Generation Prompt 
              <span className="ml-2 text-sm font-normal text-gray-400">
                ({localPrompts.language === 'hindi' ? 'हिंदी' : 'English'})
              </span>
            </h3>
            <p className="text-sm text-gray-400">This prompt is sent to Gemini to generate video content</p>
          </div>
        </div>

        <textarea
          value={localPrompts.language === 'hindi' ? localPrompts.contentPromptHindi : localPrompts.contentPrompt}
          onChange={(e) => handleChange(
            localPrompts.language === 'hindi' ? 'contentPromptHindi' : 'contentPrompt', 
            e.target.value
          )}
          className="w-full h-80 px-4 py-3 rounded-xl border border-white/10 placeholder-gray-500 focus:outline-none focus:border-primary-500/50 focus:ring-2 focus:ring-primary-500/20 transition-all font-mono text-sm leading-relaxed"
          placeholder="Enter your content generation prompt..."
          style={{ 
            backgroundColor: '#1a1a2e', 
            color: '#a0aec0'
          }}
        />

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <FileText className="w-4 h-4" />
          <span>The prompt should instruct Gemini to return JSON with: title, hook, script, imagePrompt, tags, category</span>
        </div>
      </motion.div>

      {/* Voice & Style Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Voice Selection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Voice</h3>
              <p className="text-sm text-gray-400">Text-to-speech voice for narration</p>
            </div>
          </div>

          <div className="space-y-2">
            {filteredVoices.map((voice) => (
              <label
                key={voice.id}
                className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                  localPrompts.defaultVoice === voice.id
                    ? 'bg-green-500/20 border border-green-500/50'
                    : 'bg-dark-800/50 border border-white/5 hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="voice"
                    value={voice.id}
                    checked={localPrompts.defaultVoice === voice.id}
                    onChange={(e) => handleChange('defaultVoice', e.target.value)}
                    className="hidden"
                  />
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    localPrompts.defaultVoice === voice.id 
                      ? 'border-green-500 bg-green-500' 
                      : 'border-gray-500'
                  }`}>
                    {localPrompts.defaultVoice === voice.id && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                  <div>
                    <p className="text-white font-medium">{voice.name}</p>
                    <p className="text-xs text-gray-500">{voice.desc}</p>
                  </div>
                </div>
              </label>
            ))}
            {filteredVoices.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-4">
                Select a language first to see available voices
              </p>
            )}
          </div>
        </motion.div>

        {/* Style Selection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <Palette className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Visual Style</h3>
              <p className="text-sm text-gray-400">Style hint for image generation</p>
            </div>
          </div>

          <div className="space-y-2">
            {styles.map((style) => (
              <label
                key={style.id}
                className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                  localPrompts.defaultStyle === style.id
                    ? 'bg-orange-500/20 border border-orange-500/50'
                    : 'bg-dark-800/50 border border-white/5 hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="style"
                    value={style.id}
                    checked={localPrompts.defaultStyle === style.id}
                    onChange={(e) => handleChange('defaultStyle', e.target.value)}
                    className="hidden"
                  />
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    localPrompts.defaultStyle === style.id 
                      ? 'border-orange-500 bg-orange-500' 
                      : 'border-gray-500'
                  }`}>
                    {localPrompts.defaultStyle === style.id && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                  <div>
                    <p className="text-white font-medium">{style.name}</p>
                    <p className="text-xs text-gray-500">{style.desc}</p>
                  </div>
                </div>
              </label>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Preview Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass-card p-6"
      >
        <h3 className="text-lg font-semibold text-white mb-4">Expected Output Format</h3>
        <pre className="bg-dark-900/50 p-4 rounded-xl text-sm text-gray-300 overflow-x-auto">
{`{
  "title": "Did You Know Honey Never Spoils?",
  "hook": "Scientists found 3000-year-old honey that's still edible!",
  "script": "Honey is the only food that never spoils. Archaeologists found 3000-year-old honey in Egyptian tombs that was still perfectly edible. This is because honey has low moisture and high acidity.",
  "imagePrompt": "Ancient Egyptian tomb with golden honey jar, dramatic lighting, cinematic",
  "tags": ["#Shorts", "#Facts", "#Honey", "#Science", "#Amazing"],
  "category": "Education"
}`}
        </pre>
      </motion.div>
    </div>
  )
}
