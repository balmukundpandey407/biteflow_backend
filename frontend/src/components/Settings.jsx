import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  LockKeyhole,
  Pencil,
  Settings2,
  UserRound,
  X,
} from 'lucide-react'

const API_ORIGIN = 'https://crispy-waffle-7vjrgrx67pww2w55w-8000.app.github.dev'
const PREFERENCES_KEY = 'biteflow_profile_preferences'
const PANELS = [
  { id: 'account', label: 'Account', Icon: UserRound },
  { id: 'personalization', label: 'Personalization', Icon: Settings2 },
  { id: 'notifications', label: 'Notifications', Icon: Bell },
  { id: 'privacy', label: 'Privacy & Security', Icon: LockKeyhole },
]

function readPreferences() {
  try {
    return JSON.parse(localStorage.getItem(PREFERENCES_KEY) || '{}')
  } catch {
    return {}
  }
}

function Settings({ token, onClose, onLogout }) {
  const [storedPreferences] = useState(readPreferences)
  const [user, setUser] = useState(null)
  const [activePanel, setActivePanel] = useState(null)
  const [displayName, setDisplayName] = useState(storedPreferences.displayName || '')
  const [avatar, setAvatar] = useState(storedPreferences.avatar || '')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    storedPreferences.notificationsEnabled ?? true,
  )
  const [personalizationEnabled, setPersonalizationEnabled] = useState(
    storedPreferences.personalizationEnabled ?? true,
  )

  useEffect(() => {
    if (!token) return undefined
    const controller = new AbortController()
    fetch(`${API_ORIGIN}/user/me`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(data.detail || `Account request failed (${response.status}).`)
        }
        setUser(data.user || data)
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') {
          setError('Could not load your account details. Please try again later.')
          console.error('Unable to load Biteflow account settings', requestError)
        }
      })
    return () => controller.abort()
  }, [token])

  const savePreferences = () => {
    const preferences = {
      ...readPreferences(),
      displayName: displayName.trim(),
      avatar,
      notificationsEnabled,
      personalizationEnabled,
    }
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences))
    window.dispatchEvent(new Event('biteflow-preferences-changed'))
    setMessage('Your settings have been saved on this device.')
    setError('')
  }

  const chooseAvatar = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file for your avatar.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Choose an image smaller than 2 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatar(reader.result)
        setError('')
      }
    }
    reader.onerror = () => setError('Could not read the selected image.')
    reader.readAsDataURL(file)
  }

  const openPanel = (panelId) => {
    setMessage('')
    setError('')
    setActivePanel(panelId)
  }

  const panelTitle = PANELS.find((panel) => panel.id === activePanel)?.label

  return (
    <div
      className="fixed inset-0 z-[70] flex justify-end bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Biteflow settings"
        onClick={(event) => event.stopPropagation()}
        className="h-full w-full max-w-md overflow-y-auto border-l border-white/15 bg-white/90 px-5 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))] text-neutral-900 shadow-2xl backdrop-blur-md"
      >
        {activePanel ? (
          <>
            <div className="mb-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActivePanel(null)}
                className="grid size-10 place-items-center rounded-full border border-orange-500/20 bg-white/85 text-neutral-800 shadow-sm"
                aria-label="Back to settings"
              >
                <ArrowLeft size={20} />
              </button>
              <h2 className="text-xl font-extrabold">{panelTitle}</h2>
              <button
                type="button"
                onClick={onClose}
                className="ml-auto grid size-9 place-items-center rounded-full bg-white/85"
                aria-label="Close settings"
              >
                <X size={18} />
              </button>
            </div>

            {activePanel === 'account' && (
              <div className="space-y-4 rounded-2xl border border-orange-500/20 bg-white/85 p-4 shadow-sm">
                <div className="flex items-center gap-4">
                  {avatar ? (
                    <img
                      src={avatar}
                      alt=""
                      className="size-20 rounded-full border border-orange-500/20 object-cover"
                    />
                  ) : (
                    <span className="grid size-20 place-items-center rounded-full border border-orange-500/20 bg-orange-50 text-orange-600">
                      <UserRound size={32} />
                    </span>
                  )}
                  <label className="cursor-pointer rounded-full border border-orange-500/20 bg-orange-50 px-3 py-2 text-xs font-bold text-orange-800">
                    Change avatar
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={chooseAvatar}
                    />
                  </label>
                </div>
                <label className="block text-sm font-semibold">
                  Display name
                  <span className="mt-1 flex items-center gap-2 rounded-xl border border-orange-500/20 bg-white px-3 py-2.5">
                    <input
                      value={displayName || user?.first_name || ''}
                      onChange={(event) => setDisplayName(event.target.value)}
                      placeholder="Your name"
                      className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                    />
                    <Pencil size={16} className="text-orange-600" />
                  </span>
                </label>
                <p className="text-xs text-neutral-500">
                  {user?.email || 'Sign in to load account details.'}
                </p>
                <p className="text-xs text-neutral-500">
                  Name and avatar changes are saved on this device.
                </p>
              </div>
            )}

            {activePanel === 'personalization' && (
              <button
                type="button"
                onClick={() => setPersonalizationEnabled((enabled) => !enabled)}
                className="flex w-full items-center justify-between rounded-2xl border border-orange-500/20 bg-white/85 p-4 text-left shadow-sm"
                aria-pressed={personalizationEnabled}
              >
                <span>
                  <span className="block text-sm font-bold">Personalized recommendations</span>
                  <span className="mt-1 block text-xs text-neutral-500">
                    Use your searches and activity to order recommendations.
                  </span>
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-bold text-white ${personalizationEnabled ? 'bg-emerald-500' : 'bg-neutral-400'}`}>
                  {personalizationEnabled ? 'On' : 'Off'}
                </span>
              </button>
            )}

            {activePanel === 'notifications' && (
              <button
                type="button"
                onClick={() => setNotificationsEnabled((enabled) => !enabled)}
                className="flex w-full items-center justify-between rounded-2xl border border-orange-500/20 bg-white/85 p-4 text-left shadow-sm"
                aria-pressed={notificationsEnabled}
              >
                <span>
                  <span className="block text-sm font-bold">Biteflow notifications</span>
                  <span className="mt-1 block text-xs text-neutral-500">
                    Control product and order notification preferences.
                  </span>
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-bold text-white ${notificationsEnabled ? 'bg-emerald-500' : 'bg-neutral-400'}`}>
                  {notificationsEnabled ? 'On' : 'Off'}
                </span>
              </button>
            )}

            {activePanel === 'privacy' && (
              <div className="rounded-2xl border border-orange-500/20 bg-white/85 p-4 shadow-sm">
                <h3 className="text-sm font-bold">Privacy & Security</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                  Your account is protected by your sign-in token. Sign out on shared devices and only share information you are comfortable making visible.
                </p>
                <p className="mt-3 text-xs text-neutral-500">
                  Location is stored on this device and can be changed from Home.
                </p>
              </div>
            )}

            {message && <p role="status" className="mt-4 text-sm text-emerald-700">{message}</p>}
            {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
            <button
              type="button"
              onClick={savePreferences}
              className="mt-5 w-full rounded-xl bg-[#FF6600] py-3 text-sm font-extrabold text-white"
            >
              Save settings
            </button>
          </>
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-orange-600">Biteflow</p>
                <h2 className="mt-1 text-2xl font-extrabold">Settings</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="grid size-10 place-items-center rounded-full border border-orange-500/20 bg-white/85"
                aria-label="Close settings"
              >
                <X size={20} />
              </button>
            </div>
            <div className="mb-5 flex items-center gap-3 rounded-2xl border border-orange-500/20 bg-white/85 p-4 shadow-sm">
              {avatar ? (
                <img
                  src={avatar}
                  alt=""
                  className="size-14 rounded-full border border-orange-500/20 object-cover"
                />
              ) : (
                <span className="grid size-14 place-items-center rounded-full border border-orange-500/20 bg-orange-50 text-orange-600">
                  <UserRound size={24} />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-bold">
                  {displayName || `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'Biteflow Member'}
                </span>
                <span className="block truncate text-xs text-neutral-500">
                  {user?.email || 'Biteflow account'}
                </span>
              </span>
              <button
                type="button"
                onClick={() => openPanel('account')}
                className="grid size-9 place-items-center rounded-full bg-orange-50 text-orange-700"
                aria-label="Edit profile"
              >
                <Pencil size={17} />
              </button>
            </div>
            <div className="overflow-hidden rounded-2xl border border-orange-500/20 bg-white/85 shadow-sm">
              {PANELS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => openPanel(id)}
                  className="flex w-full items-center gap-3 border-b border-orange-500/10 px-4 py-4 text-left text-sm font-semibold last:border-0 hover:bg-orange-50/70"
                >
                  <Icon size={18} className="text-orange-600" />
                  <span className="flex-1">{label}</span>
                  <ChevronRight size={18} className="text-neutral-400" />
                </button>
              ))}
            </div>
            {message && <p role="status" className="mt-4 text-sm text-emerald-700">{message}</p>}
            {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
            <button
              type="button"
              onClick={savePreferences}
              className="mt-5 w-full rounded-xl border border-orange-500/20 bg-white/85 py-3 text-sm font-bold text-neutral-700"
            >
              Save settings
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="mt-3 w-full rounded-xl bg-red-50 py-3 text-sm font-bold text-red-600"
            >
              Log out
            </button>
          </>
        )}
      </section>
    </div>
  )
}

export default Settings
