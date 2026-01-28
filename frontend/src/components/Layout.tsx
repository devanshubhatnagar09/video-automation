import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  LayoutDashboard, 
  Settings, 
  GitBranch, 
  History, 
  Sparkles,
  Zap,
  FileText
} from 'lucide-react'

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/workflow', icon: GitBranch, label: 'Workflow' },
  { path: '/prompts', icon: FileText, label: 'Prompts' },
  { path: '/history', icon: History, label: 'History' },
  { path: '/settings', icon: Settings, label: 'Settings' },
]

export default function Layout() {
  const location = useLocation()

  return (
    <div className="min-h-screen flex" style={{ background: 'transparent' }}>
      {/* Sidebar */}
      <motion.aside 
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="w-72 glass border-r border-white/10 flex flex-col"
      >
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <motion.div 
            className="flex items-center gap-3"
            whileHover={{ scale: 1.02 }}
          >
            <div className="w-12 h-12 rounded-xl animated-gradient flex items-center justify-center glow">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold gradient-text">VideoAI</h1>
              <p className="text-xs text-gray-400">Automated Generation</p>
            </div>
          </motion.div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${
                  isActive
                    ? 'bg-gradient-to-r from-primary-500/20 to-accent-500/20 text-white border border-white/10 glow'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={`w-5 h-5 ${isActive ? 'text-primary-400' : 'group-hover:text-primary-400'}`} />
                  <span className="font-medium">{item.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="ml-auto w-2 h-2 rounded-full bg-primary-400"
                      initial={false}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Status Card */}
        <div className="p-4 m-4 rounded-xl glass-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-green-400 pulse-dot" />
            <span className="text-sm text-gray-300">System Active</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Zap className="w-3 h-3" />
            <span>Daily cron enabled</span>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="p-8"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-1/4 w-96 h-96 bg-accent-500/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary-900/10 rounded-full blur-3xl" />
      </div>
    </div>
  )
}
