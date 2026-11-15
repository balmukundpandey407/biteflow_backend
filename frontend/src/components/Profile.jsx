import { useEffect, useState } from 'react'
import {
  Check,
  CircleUserRound,
  Menu,
  Pencil,
  Play,
  Plus,
  ShoppingBag,
  X,
} from 'lucide-react'
import { API_BASE_URL } from '../api.js'
const BITE_FILTERS = [
  { id: 'mine', label: 'My Bites' },
  { id: 'liked', label: 'Liked' },
  { id: 'saved', label: 'Saved' },
]

async function fetchJson(path, token, signal) {
  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      signal,
    })
  } catch (requestError) {
    if (requestError.name === 'AbortError') throw requestError
    throw new Error(
      'Could not connect to Biteflow. Check your connection and try again.',
      { cause: requestError },
    )
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = Array.isArray(data.detail)
      ? data.detail.map((entry) => entry.msg).join(' ')
      : data.detail || data.error
    const error = new Error(detail || `Request failed (${response.status}).`)
    error.status = response.status
    throw error
  }
  return data
}

function getItems(data) {
  if (Array.isArray(data)) return data
  return data.items || data.videos || data.data || []
}

function Profile({ token, onLogin, onCreate, onOpenSettings, reels, onOpenBites, onOrder }) {
  const [activeSection, setActiveSection] = useState('bites')
  const [activeBiteFilter, setActiveBiteFilter] = useState('mine')
  const [profileData, setProfileData] = useState({
    user: null,
    mine: [],
    liked: [],
    saved: [],
    orders: [],
  })
  const [loadedToken, setLoadedToken] = useState(null)
  const loading = Boolean(token) && loadedToken !== token
  const [error, setError] = useState('')
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editAvatar, setEditAvatar] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [editingBite, setEditingBite] = useState(null)
  const [editFoods, setEditFoods] = useState([])
  const [savingBite, setSavingBite] = useState(false)
  const [preferences, setPreferences] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('biteflow_profile_preferences') || '{}')
    } catch {
      return {}
    }
  })

  useEffect(() => {
    const refreshPreferences = () => {
      try {
        setPreferences(JSON.parse(localStorage.getItem('biteflow_profile_preferences') || '{}'))
      } catch {
        setPreferences({})
      }
    }
    window.addEventListener('biteflow-preferences-changed', refreshPreferences)
    return () => window.removeEventListener('biteflow-preferences-changed', refreshPreferences)
  }, [])

  useEffect(() => {
    if (!token) return undefined

    const controller = new AbortController()
    async function loadProfile() {
      try {
        const [userData, mineData, likedData, savedData, orderData] =
          await Promise.all([
            fetchJson('/users/me', token, controller.signal).catch((requestError) => {
              if (requestError.status !== 404) throw requestError
              return fetchJson('/user/me', token, controller.signal)
            }),
            fetchJson('/user/me/videos', token, controller.signal),
            fetchJson('/user/me/liked', token, controller.signal),
            fetchJson('/user/me/saved', token, controller.signal),
            fetchJson('/orders', token, controller.signal),
          ])
        if (controller.signal.aborted) return
        setProfileData({
          user: userData.user || userData,
          mine: getItems(mineData),
          liked: getItems(likedData),
          saved: getItems(savedData),
          orders: getItems(orderData),
        })
      } catch (requestError) {
        if (!controller.signal.aborted) {
          console.error('Unable to load Biteflow profile', requestError)
        }
      } finally {
        if (!controller.signal.aborted) setLoadedToken(token)
      }
    }

    loadProfile()
    return () => controller.abort()
  }, [token])

  const bites =
    activeBiteFilter === 'mine'
      ? profileData.mine
      : activeBiteFilter === 'liked'
        ? profileData.liked
        : profileData.saved

  const handleReorder = (order) => {
    const food = order.food_item || {
      id: order.food_item_id,
      name: order.food_name,
      price: order.unit_price,
      image_url: order.image_url,
      restaurants: order.restaurant ? { name: order.restaurant.name } : undefined,
    }
    const matchingReel =
      reels.find(
        (reel) =>
          reel.food_item_id === food.id || reel.food_item?.id === food.id,
      ) || {
        id: order.video_id || null,
        food_item_id: food.id,
        food_item: food,
      }
    onOrder(matchingReel)
  }

  const openEditProfile = () => {
    const user = profileData.user || {}
    setEditName(
      preferences.displayName ||
        `${user.first_name || ''} ${user.last_name || ''}`.trim(),
    )
    setEditAvatar(preferences.avatar || user.avatar_url || '')
    setError('')
    setIsEditOpen(true)
  }

  const chooseAvatar = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > 2 * 1024 * 1024) {
      setError('Choose an image smaller than 2 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') setEditAvatar(reader.result)
    }
    reader.onerror = () => setError('Could not read the selected image.')
    reader.readAsDataURL(file)
  }

  const saveProfile = async (event) => {
    event.preventDefault()
    if (!token) return
    const [firstName, ...lastName] = editName.trim().split(/\s+/)
    if (!firstName) {
      setError('Enter your name before saving.')
      return
    }
    setSavingProfile(true)
    setError('')
    try {
      let response = await fetch(`${API_BASE_URL}/users/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName.join(' ') || null,
          avatar_url: editAvatar || null,
        }),
      })
      if (response.status === 404) {
        response = await fetch(`${API_BASE_URL}/user/me`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            first_name: firstName,
            last_name: lastName.join(' ') || null,
            avatar_url: editAvatar || null,
          }),
        })
      }
      if (!response.ok) {
        throw new Error(
          response.status === 404 || response.status === 405
            ? 'Profile editing is not available on the server yet.'
            : "Couldn't save your profile right now. Please try again.",
        )
      }
      const data = await response.json().catch(() => ({}))
      const updatedUser = data.user || data
      setProfileData((current) => ({
        ...current,
        user: { ...current.user, ...updatedUser, first_name: firstName, last_name: lastName.join(' ') },
      }))
      const nextPreferences = {
        ...preferences,
        displayName: editName.trim(),
        avatar: editAvatar,
      }
      localStorage.setItem('biteflow_profile_preferences', JSON.stringify(nextPreferences))
      setPreferences(nextPreferences)
      setIsEditOpen(false)
    } catch (saveError) {
      setError(saveError.message || "Couldn't save your profile right now. Please try again.")
    } finally {
      setSavingProfile(false)
    }
  }

  const openBiteEditor = async (reel) => {
    setError('')
    setEditingBite({
      ...reel,
      food_item_id: reel.food_item_id || reel.food_item?.id || '',
      is_veg: ['true', '1', 'yes', 'veg', 'vegetarian'].includes(
        String(reel.food_item?.is_veg ?? '').toLowerCase(),
      ),
    })
    try {
      const foodData = await fetchJson('/items', token)
      setEditFoods(getItems(foodData))
    } catch (requestError) {
      console.error('Unable to load food items for Bite editing', requestError)
      setEditFoods(reel.food_item ? [reel.food_item] : [])
    }
  }

  const saveBite = async (event) => {
    event.preventDefault()
    if (!editingBite || !token) return
    setSavingBite(true)
    setError('')
    try {
      const response = await fetch(
        `${API_BASE_URL}/videos/${encodeURIComponent(editingBite.id)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: editingBite.title.trim(),
            description: editingBite.description || '',
            food_item_id: editingBite.food_item_id,
            is_veg: editingBite.is_veg,
          }),
        },
      )
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.detail || "Couldn't update this Bite. Please try again.")
      }
      setProfileData((current) => ({
        ...current,
        mine: current.mine.map((bite) => bite.id === data.id ? data : bite),
      }))
      setEditingBite(null)
    } catch (saveError) {
      setError(saveError.message || "Couldn't update this Bite. Please try again.")
    } finally {
      setSavingBite(false)
    }
  }

  return (
    <main className="mx-auto min-h-[calc(100dvh-4rem)] w-full max-w-md bg-white pb-20 text-neutral-900">
      <header className="flex items-center justify-between border-b border-white/15 bg-[#FF6600]/90 px-4 py-3 text-white shadow-sm backdrop-blur-md">
        <h1 className="text-xl font-extrabold">Profile</h1>
        <div className="flex items-center gap-4">
          <button type="button" aria-label="Create Bite" onClick={onCreate}>
            <Plus size={24} />
          </button>
          <button type="button" aria-label="Open settings" onClick={onOpenSettings}>
            <Menu size={22} />
          </button>
        </div>
      </header>

      <section className="flex items-center gap-4 px-5 py-7">
        <button type="button" onClick={openEditProfile} aria-label="Edit profile photo">
          {preferences.avatar || profileData.user?.avatar_url ? (
            <img
              src={preferences.avatar || profileData.user.avatar_url}
              alt=""
              className="size-24 shrink-0 rounded-full border border-orange-500/20 object-cover"
            />
          ) : (
            <span className="grid size-24 shrink-0 place-items-center rounded-full border border-orange-500/20 bg-white/85 text-[#FF6600] shadow-sm backdrop-blur-md">
              <CircleUserRound size={66} strokeWidth={1.7} />
            </span>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-xl font-semibold">
              {preferences.displayName || (profileData.user
                ? `${profileData.user.first_name || ''} ${profileData.user.last_name || ''}`.trim() ||
                  'Your profile'
                : loading ? 'Loading profile…' : 'Your profile')}
            </p>
            <button
              type="button"
              onClick={openEditProfile}
              aria-label="Edit profile"
              className="grid size-8 shrink-0 place-items-center rounded-full text-[#FF6600]"
            >
              <Pencil size={17} />
            </button>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            {[profileData.user?.email, profileData.user?.phone].filter(Boolean).join(' · ') ||
              (token ? 'Your Biteflow profile' : 'Sign in to personalize your profile')}
          </p>
          {!token && (
            <button
              type="button"
              onClick={onLogin}
              className="mt-2 text-sm font-bold text-[#FF6600]"
            >
              Login or Sign Up
            </button>
          )}
        </div>
      </section>

      <section className="mb-4 flex justify-around border-y border-orange-500/10 py-3">
        <button
          type="button"
          onClick={() => setActiveSection('bites')}
          className={`relative grid size-11 place-items-center rounded-xl border backdrop-blur-md ${
            activeSection === 'bites'
              ? 'border-orange-500/30 bg-orange-500/10 text-[#FF6600]'
              : 'border-orange-500/15 bg-white/85 text-neutral-400'
          }`}
          aria-label="Bites"
          aria-pressed={activeSection === 'bites'}
        >
          <Play size={23} />
          {activeSection === 'bites' && (
            <span className="absolute -bottom-3 h-1 w-6 rounded-full bg-[#FF6600]" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('orders')}
          className={`relative grid size-11 place-items-center rounded-xl border backdrop-blur-md ${
            activeSection === 'orders'
              ? 'border-orange-500/30 bg-orange-500/10 text-[#FF6600]'
              : 'border-orange-500/15 bg-white/85 text-neutral-400'
          }`}
          aria-label="Order history"
          aria-pressed={activeSection === 'orders'}
        >
          <Check size={25} strokeWidth={2.5} />
          {activeSection === 'orders' && (
            <span className="absolute -bottom-3 h-1 w-6 rounded-full bg-[#FF6600]" />
          )}
        </button>
      </section>

      {!token ? (
        <div className="mx-4 rounded-2xl border border-orange-500/20 bg-white/85 px-5 py-8 text-center text-sm text-neutral-500 shadow-sm backdrop-blur-md">
          Sign in to view your Bites, saved items, and order history.
        </div>
      ) : loading ? (
        <div className="mx-4 h-32 animate-pulse rounded-2xl border border-orange-500/20 bg-orange-50" />
      ) : activeSection === 'bites' ? (
        <>
          <div className="mb-4 flex gap-2 overflow-x-auto px-4">
            {BITE_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setActiveBiteFilter(filter.id)}
                className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-bold shadow-sm backdrop-blur-md transition ${
                  activeBiteFilter === filter.id
                    ? 'border-orange-500/30 bg-orange-500/15 text-orange-800'
                    : 'border-orange-500/20 bg-white/85 text-neutral-600'
                }`}
                aria-pressed={activeBiteFilter === filter.id}
              >
                {filter.label}
              </button>
            ))}
          </div>
          {bites.length ? (
            <div className="grid grid-cols-3 gap-2 px-2">
              {bites.map((reel, index) => (
                <article
                  key={reel.id ?? index}
                  className="relative aspect-[0.72] overflow-hidden rounded-xl border border-white/15 bg-neutral-900 text-left text-white"
                >
                  <button
                    type="button"
                    onClick={() => onOpenBites(reel)}
                    className="absolute inset-0 h-full w-full text-left"
                  >
                    {reel.thumbnail_url && (
                      <img
                        src={reel.thumbnail_url}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    )}
                    <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <span className="absolute inset-x-2 bottom-2">
                      <span className="line-clamp-2 block text-xs font-bold">
                        {reel.food_item?.name || reel.title}
                      </span>
                      <span className="mt-1 block text-[10px]">
                        {reel.total_views ?? 0} views
                      </span>
                    </span>
                  </button>
                  {activeBiteFilter === 'mine' && (
                    <button
                      type="button"
                      onClick={() => void openBiteEditor(reel)}
                      className="absolute right-2 top-2 z-10 grid size-8 place-items-center rounded-full bg-black/65 text-white backdrop-blur-md"
                      aria-label={`Edit ${reel.title || 'Bite'}`}
                    >
                      <Pencil size={15} />
                    </button>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className="px-5 py-8 text-center text-sm text-neutral-500">
              {activeBiteFilter === 'mine'
                ? 'Nothing to show here yet — post your first Bite!'
                : activeBiteFilter === 'liked'
                  ? 'You have not liked any Bites yet.'
                  : 'You have not saved any Bites yet.'}
            </p>
          )}
        </>
      ) : (
        <section>
          <h2 className="mb-3 px-4 text-base font-extrabold">Order History</h2>
          {profileData.orders.length ? (
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4">
              {profileData.orders.map((order) => {
                const food = order.food_item
                const restaurantName =
                  order.restaurant?.name || food?.restaurants?.name || ''
                return (
                  <article
                    key={order.id}
                    className="w-[82%] shrink-0 snap-center overflow-hidden rounded-2xl border border-orange-500/20 bg-white/85 shadow-sm backdrop-blur-md"
                  >
                    <div className="flex gap-3 p-3">
                      <img
                        src={food?.image_url || order.image_url || undefined}
                        alt=""
                        className="size-20 shrink-0 rounded-xl bg-orange-50 object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-extrabold">
                          {food?.name || order.food_name || 'Dish'}
                        </h3>
                        <p className="mt-1 truncate text-xs text-neutral-500">
                          {restaurantName}
                        </p>
                        <p className="mt-1 text-xs text-neutral-600">
                          Qty {order.quantity} · ₹{order.total_price}
                        </p>
                        <span className="mt-1.5 inline-flex rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold capitalize text-orange-800">
                          {order.status || 'pending'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleReorder(order)}
                      className="flex w-full items-center justify-center gap-2 border-t border-orange-500/10 bg-white/60 py-3 text-sm font-bold text-[#FF6600]"
                    >
                      <ShoppingBag size={16} />
                      Reorder
                    </button>
                  </article>
                )
              })}
            </div>
          ) : (
            <p className="px-5 py-8 text-center text-sm text-neutral-500">
              No orders yet
            </p>
          )}
        </section>
      )}

      {isEditOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-3 backdrop-blur-sm sm:items-center"
          onClick={() => setIsEditOpen(false)}
        >
          <form
            onSubmit={saveProfile}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md rounded-3xl border border-white/60 bg-white/90 p-5 text-neutral-900 shadow-2xl backdrop-blur-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Edit profile"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-extrabold">Edit profile</h2>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="grid size-9 place-items-center rounded-full bg-orange-50"
                aria-label="Close edit profile"
              >
                <X size={19} />
              </button>
            </div>
            <div className="mb-4 flex items-center gap-4">
              {editAvatar ? (
                <img src={editAvatar} alt="" className="size-20 rounded-full object-cover" />
              ) : (
                <span className="grid size-20 place-items-center rounded-full bg-orange-50 text-orange-600">
                  <CircleUserRound size={42} />
                </span>
              )}
              {editingBite && (
                <div
                  className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-3 backdrop-blur-sm sm:items-center"
                  onClick={() => setEditingBite(null)}
                >
                  <form
                    onSubmit={saveBite}
                    onClick={(event) => event.stopPropagation()}
                    className="max-h-[90dvh] w-full max-w-md space-y-4 overflow-y-auto rounded-3xl border border-white/60 bg-white/90 p-5 text-neutral-900 shadow-2xl backdrop-blur-2xl"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Edit Bite"
                  >
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-extrabold">Edit Bite</h2>
                      <button
                        type="button"
                        onClick={() => setEditingBite(null)}
                        className="grid size-9 place-items-center rounded-full bg-orange-50"
                        aria-label="Close Bite editor"
                      >
                        <X size={19} />
                      </button>
                    </div>
                    <label className="block text-sm font-semibold">
                      Title
                      <input
                        required
                        maxLength={25}
                        value={editingBite.title || ''}
                        onChange={(event) => setEditingBite((bite) => ({ ...bite, title: event.target.value }))}
                        className="mt-1.5 w-full rounded-xl border border-orange-500/20 bg-white px-3.5 py-3 outline-none focus:border-orange-500"
                      />
                    </label>
                    <label className="block text-sm font-semibold">
                      Description / Hashtags
                      <textarea
                        maxLength={50}
                        rows={3}
                        value={editingBite.description || ''}
                        onChange={(event) => setEditingBite((bite) => ({ ...bite, description: event.target.value }))}
                        className="mt-1.5 w-full resize-none rounded-xl border border-orange-500/20 bg-white px-3.5 py-3 outline-none focus:border-orange-500"
                      />
                    </label>
                    <label className="block text-sm font-semibold">
                      Linked dish
                      <select
                        required
                        value={editingBite.food_item_id}
                        onChange={(event) => {
                          const food = editFoods.find((item) => item.id === event.target.value)
                          setEditingBite((bite) => ({
                            ...bite,
                            food_item_id: event.target.value,
                            is_veg: food
                              ? ['true', '1', 'yes', 'veg', 'vegetarian'].includes(String(food.is_veg).toLowerCase())
                              : bite.is_veg,
                          }))
                        }}
                        className="mt-1.5 w-full rounded-xl border border-orange-500/20 bg-white px-3.5 py-3 outline-none focus:border-orange-500"
                      >
                        {editFoods.map((food) => (
                          <option key={food.id} value={food.id}>{food.name}</option>
                        ))}
                      </select>
                    </label>
                    <fieldset>
                      <legend className="mb-2 text-sm font-semibold">Food type</legend>
                      <div className="grid grid-cols-2 gap-2">
                        {[true, false].map((veg) => (
                          <button
                            key={String(veg)}
                            type="button"
                            onClick={() => setEditingBite((bite) => ({ ...bite, is_veg: veg }))}
                            className={`rounded-xl border px-3 py-2 text-sm font-bold ${
                              editingBite.is_veg === veg
                                ? veg ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-red-500 bg-red-50 text-red-800'
                                : 'border-neutral-200 bg-white text-neutral-600'
                            }`}
                            aria-pressed={editingBite.is_veg === veg}
                          >
                            {veg ? '🟢 Veg' : '🔴 Non-Veg'}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                    <button
                      type="submit"
                      disabled={savingBite || !editingBite.food_item_id}
                      className="w-full rounded-xl bg-[#FF6600] py-3.5 text-sm font-extrabold text-white disabled:opacity-60"
                    >
                      {savingBite ? 'Saving…' : 'Save Bite'}
                    </button>
                  </form>
                </div>
              )}
              <label className="cursor-pointer rounded-xl border border-orange-500/20 bg-white px-3 py-2 text-sm font-bold text-orange-700">
                Change photo
                <input type="file" accept="image/*" className="sr-only" onChange={chooseAvatar} />
              </label>
            </div>
            <label className="block text-sm font-semibold">
              Name
              <input
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-orange-500/20 bg-white px-3.5 py-3 outline-none focus:border-orange-500"
                autoComplete="name"
              />
            </label>
            {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
            <button
              type="submit"
              disabled={savingProfile}
              className="mt-5 w-full rounded-xl bg-[#FF6600] py-3.5 text-sm font-extrabold text-white disabled:opacity-60"
            >
              {savingProfile ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        </div>
      )}
    </main>
  )
}

export default Profile
