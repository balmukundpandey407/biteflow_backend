import { useEffect, useState } from 'react'
import {
  Check,
  ChevronRight,
  CircleUserRound,
  Pencil,
  Play,
  ShoppingBag,
} from 'lucide-react'

const API_ORIGIN = 'https://crispy-waffle-7vjrgrx67pww2w55w-8000.app.github.dev'
const BITE_FILTERS = [
  { id: 'mine', label: 'My Bites' },
  { id: 'liked', label: 'Liked' },
  { id: 'saved', label: 'Saved' },
]

async function fetchJson(path, token, signal) {
  let response
  try {
    response = await fetch(`${API_ORIGIN}${path}`, {
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
    throw new Error(detail || `Request failed (${response.status}).`)
  }
  return data
}

function getItems(data) {
  if (Array.isArray(data)) return data
  return data.items || data.videos || data.data || []
}

function Profile({ token, onLogin, onCreate, reels, onOpenBites, onOrder }) {
  const [activeSection, setActiveSection] = useState('bites')
  const [activeBiteFilter, setActiveBiteFilter] = useState('mine')
  const [profileData, setProfileData] = useState({
    user: null,
    mine: [],
    liked: [],
    saved: [],
    orders: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return undefined

    const controller = new AbortController()
    async function loadProfile() {
      try {
        const [userData, mineData, likedData, savedData, orderData] =
          await Promise.all([
            fetchJson('/user/me', token, controller.signal),
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
          setError(requestError.message || 'Unable to load your profile.')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
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

  return (
    <main className="mx-auto min-h-[calc(100dvh-4rem)] w-full max-w-md bg-white pb-20 text-neutral-900">
      <header className="flex items-center justify-between border-b border-white/15 bg-[#FF6600]/90 px-4 py-3 text-white shadow-sm backdrop-blur-md">
        <h1 className="text-xl font-extrabold">Profile</h1>
        <div className="flex items-center gap-4">
          <button type="button" aria-label="Create Bite" onClick={onCreate}>
            <Pencil size={22} />
          </button>
          <button type="button" aria-label="Profile settings">
            <ChevronRight size={22} />
          </button>
        </div>
      </header>

      <section className="flex items-center gap-4 px-5 py-7">
        <span className="grid size-24 shrink-0 place-items-center rounded-full border border-orange-500/20 bg-white/85 text-[#FF6600] shadow-sm backdrop-blur-md">
          <CircleUserRound size={66} strokeWidth={1.7} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-semibold">
            {profileData.user
              ? `${profileData.user.first_name || ''} ${profileData.user.last_name || ''}`.trim() ||
                'Biteflow Member'
              : 'Biteflow Member'}
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            {token ? 'Your Biteflow profile' : 'Sign in to personalize your profile'}
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
      ) : error ? (
        <p role="alert" className="mx-4 rounded-2xl bg-red-50 px-4 py-5 text-sm text-red-700">
          {error}
        </p>
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
                <button
                  key={reel.id ?? index}
                  type="button"
                  onClick={() => onOpenBites(reel)}
                  className="relative aspect-[0.72] overflow-hidden rounded-xl border border-white/15 bg-neutral-900 text-left text-white"
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
              ))}
            </div>
          ) : (
            <p className="px-5 py-8 text-center text-sm text-neutral-500">
              {activeBiteFilter === 'mine'
                ? 'Your uploaded Bites will appear here.'
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
              Your order history will appear here.
            </p>
          )}
        </section>
      )}

    </main>
  )
}

export default Profile
