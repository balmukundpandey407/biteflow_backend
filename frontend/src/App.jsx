import { useEffect, useRef, useState } from 'react'
import Feed from './components/feed.jsx'
import { Home, Play, Plus, UserRound } from 'lucide-react'

const TABS = [
  { id: 'home', label: 'Home', Icon: Home },
  { id: 'feed', label: 'Bites', Icon: Play },
  { id: 'create', label: 'Create', Icon: Plus },
  { id: 'profile', label: 'Profile', Icon: UserRound },
]

function App() {
  const [activeTab, setActiveTab] = useState('home')
  const [createRequest, setCreateRequest] = useState(0)
  const [backToast, setBackToast] = useState(false)
  const lastBackPressRef = useRef(0)

  useEffect(() => {
    if (activeTab !== 'feed' && activeTab !== 'upload') return undefined

    lastBackPressRef.current = 0
    let toastTimer
    const pushGuard = () => {
      window.history.pushState({ biteflowGuard: true }, '')
    }
    const handleBack = () => {
      const now = Date.now()
      if (now - lastBackPressRef.current <= 2000) {
        lastBackPressRef.current = 0
        setBackToast(false)
        setActiveTab('home')
        return
      }

      lastBackPressRef.current = now
      pushGuard()
      setBackToast(true)
      window.clearTimeout(toastTimer)
      toastTimer = window.setTimeout(() => setBackToast(false), 2000)
    }
    const handleKeyDown = (event) => {
      const target = event.target
      const isTyping =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      if (isTyping || !['Backspace', 'Escape'].includes(event.key)) return
      event.preventDefault()
      handleBack()
    }

    pushGuard()
    window.addEventListener('popstate', handleBack)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('popstate', handleBack)
      window.removeEventListener('keydown', handleKeyDown)
      window.clearTimeout(toastTimer)
    }
  }, [activeTab])

  return (
    <main className="min-h-full bg-black">
      <Feed
        activeTab={activeTab}
        onActiveTabChange={setActiveTab}
        createRequest={createRequest}
      />
      {activeTab !== 'feed' && activeTab !== 'upload' && (
        <nav
          aria-label="Main navigation"
          className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-between bg-[#FF6600] px-6 pb-[env(safe-area-inset-bottom)] shadow-lg"
        >
          {TABS.map(({ id, label, Icon }) => {
            const isActive = activeTab === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  if (id === 'create') {
                    setCreateRequest((request) => request + 1)
                    return
                  }
                  setActiveTab(id)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
                className="relative flex h-full flex-1 flex-col items-center justify-center gap-1 text-white"
              >
                <span className="flex size-11 items-center justify-center rounded-xl border border-white/40">
                  <Icon size={23} strokeWidth={2} />
                </span>
                {isActive && (
                  <span className="absolute bottom-1 h-1 w-8 rounded-full bg-white" />
                )}
              </button>
            )
          })}
        </nav>
      )}
      {backToast && (
        <div
          role="status"
          className="fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 whitespace-nowrap rounded-full border border-white/15 bg-black/80 px-4 py-2.5 text-sm font-semibold text-white shadow-xl backdrop-blur-md"
        >
          Press back again to return Home
        </div>
      )}
    </main>
  )
}

export default App
