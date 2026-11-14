import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Filter,
  MapPin,
  Search,
  ShoppingBag,
  X,
  LocateFixed,
  ChevronRight,
  Pencil,
} from 'lucide-react'
import { rankBites, rankDishes } from '../utils/recommendations.js'

const API_ORIGIN = 'https://crispy-waffle-7vjrgrx67pww2w55w-8000.app.github.dev'
const CATEGORIES = ['Maggi', 'Rolls', 'Coffee', 'Thali', 'Momos']
const POPULAR_CRAVINGS = ['Maggi', 'Chole bhature', 'Momos', 'Cold coffee']
const LOCATION_KEY = 'biteflow_location'
const SEARCH_HISTORY_KEY = 'biteflow_search_history'
const SEARCH_PLACEHOLDERS = ['Chole bhature ...?', 'Crispy Chicken Roll ...?']

function getSearchHistory() {
  try {
    const history = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]')
    return Array.isArray(history) ? history : []
  } catch {
    return []
  }
}

function getStoredLocation() {
  const savedLocation = localStorage.getItem(LOCATION_KEY) || ''
  return /^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(savedLocation)
    ? ''
    : savedLocation
}

function isVegetarian(value) {
  return ['true', '1', 'yes', 'veg', 'vegetarian'].includes(
    String(value).toLowerCase(),
  )
}

function isNonVegetarian(value) {
  return ['false', '0', 'no', 'non-veg', 'nonveg'].includes(
    String(value).toLowerCase(),
  )
}

function Home({ reels, loading, error, token, onOpenFeed, onOrder }) {
  const [query, setQuery] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [location, setLocation] = useState(
    getStoredLocation,
  )
  const [locationDraft, setLocationDraft] = useState(
    getStoredLocation,
  )
  const [locationError, setLocationError] = useState('')
  const [isLocationPromptOpen, setIsLocationPromptOpen] = useState(
    () => !getStoredLocation(),
  )
  const [isEditingLocation, setIsEditingLocation] = useState(
    () => !getStoredLocation(),
  )
  const [isLocationExpanded, setIsLocationExpanded] = useState(false)
  const [locationToast, setLocationToast] = useState('')
  const [isDetectingLocation, setIsDetectingLocation] = useState(false)
  const [foodMode, setFoodMode] = useState('veg')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [activePosterIndex, setActivePosterIndex] = useState(0)
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [orderHistory, setOrderHistory] = useState([])
  const searchWrapperRef = useRef(null)
  const touchStartXRef = useRef(null)
  const locationToastTimerRef = useRef(null)

  const dishes = useMemo(() => {
    const uniqueDishes = new Map()
    reels.forEach((reel) => {
      const food = reel.food_item
      if (!food?.id || !food.name || uniqueDishes.has(food.id)) return
      uniqueDishes.set(food.id, { food, reel })
    })
    return [...uniqueDishes.values()]
  }, [reels])

  const posters = reels.slice(0, 5)
  const visiblePosterIndex = posters.length
    ? activePosterIndex % posters.length
    : 0

  useEffect(() => {
    if (posters.length < 2) return undefined
    const intervalId = window.setInterval(() => {
      setActivePosterIndex((index) => (index + 1) % posters.length)
    }, 3500)
    return () => window.clearInterval(intervalId)
  }, [posters.length])

  useEffect(() => {
    if (!token) return undefined

    const controller = new AbortController()
    fetch(`${API_ORIGIN}/orders`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Could not load order history (${response.status}).`)
        }
        return response.json()
      })
      .then((data) => setOrderHistory(data.items || data.orders || []))
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') {
          console.error('Unable to load Biteflow order history for recommendations', requestError)
        }
      })
    return () => controller.abort()
  }, [token])

  useEffect(() => {
    const timerId = window.setInterval(
      () => setPlaceholderIndex((index) => (index + 1) % SEARCH_PLACEHOLDERS.length),
      3000,
    )
    return () => window.clearInterval(timerId)
  }, [])

  useEffect(
    () => () => window.clearTimeout(locationToastTimerRef.current),
    [],
  )

  useEffect(() => {
    if (!isLocationExpanded) return undefined
    const timeoutId = window.setTimeout(() => setIsLocationExpanded(false), 4000)
    return () => window.clearTimeout(timeoutId)
  }, [isLocationExpanded])

  useEffect(() => {
    const closeSearchOnOutsideClick = (event) => {
      if (!searchWrapperRef.current?.contains(event.target)) setIsSearchOpen(false)
    }
    document.addEventListener('pointerdown', closeSearchOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeSearchOnOutsideClick)
  }, [])

  const normalizedQuery = query.trim().toLowerCase()
  const filteredDishes = rankDishes(dishes, {
    foodPreference: foodMode,
    searchHistory: getSearchHistory(),
    orderHistory,
  }).filter(({ food }) => {
    const searchText = `${food.name} ${food.restaurants?.name ?? ''}`.toLowerCase()
    const matchesSearch = searchText.includes(normalizedQuery)
    const matchesCategory =
      !selectedCategory ||
      searchText.includes(selectedCategory.toLowerCase().replace(/s$/, ''))
    const matchesFoodMode =
      foodMode === 'veg'
        ? isVegetarian(food.is_veg)
        : isNonVegetarian(food.is_veg)
    return matchesSearch && matchesCategory && matchesFoodMode
  })

  const filteredReels = rankBites(reels, {
    foodPreference: foodMode,
    searchHistory: getSearchHistory(),
    orderHistory,
  }).filter((reel) => {
    const food = reel.food_item
    const searchText = `${food?.name ?? ''} ${food?.restaurants?.name ?? ''} ${
      reel.description ?? ''
    }`.toLowerCase()
    const matchesSearch = searchText.includes(normalizedQuery)
    const matchesCategory =
      !selectedCategory ||
      searchText.includes(selectedCategory.toLowerCase().replace(/s$/, ''))
    const matchesFoodMode =
      foodMode === 'veg'
        ? isVegetarian(food?.is_veg)
        : isNonVegetarian(food?.is_veg)
    return matchesSearch && matchesCategory && matchesFoodMode
  })

  const matchingSuggestions = dishes
    .filter(({ food }) =>
      `${food.name} ${food.restaurants?.name ?? ''}`
        .toLowerCase()
        .includes(normalizedQuery),
    )
    .slice(0, 4)
  const popularSuggestions = POPULAR_CRAVINGS.filter((craving) =>
    craving.toLowerCase().includes(normalizedQuery),
  ).slice(0, 4)

  const chooseLocation = (nextLocation, wasDetected = false) => {
    const cleanLocation = nextLocation.trim()
    if (!cleanLocation) {
      setLocationError('Enter your campus or hostel address to continue.')
      return
    }
    localStorage.setItem(LOCATION_KEY, cleanLocation)
    setLocation(cleanLocation)
    setLocationDraft(cleanLocation)
    setLocationError('')
    setIsLocationPromptOpen(false)
    setIsEditingLocation(false)
    if (wasDetected) {
      setIsLocationExpanded(true)
      setLocationToast('Location detected successfully')
      window.clearTimeout(locationToastTimerRef.current)
      locationToastTimerRef.current = window.setTimeout(() => setLocationToast(''), 4000)
    }
  }

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Location detection is unavailable in this browser.')
      return
    }
    setIsDetectingLocation(true)
    setLocationError('')
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const params = new URLSearchParams({
            format: 'jsonv2',
            lat: String(coords.latitude),
            lon: String(coords.longitude),
          })
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?${params}`,
            { headers: { 'Accept-Language': 'en' } },
          )
          if (!response.ok) {
            throw new Error(`Address lookup failed (${response.status}).`)
          }
          const result = await response.json()
          const address = result.address || {}
          const locality =
            address.neighbourhood ||
            address.suburb ||
            address.village ||
            address.town ||
            address.city ||
            result.name
          const district =
            address.city_district ||
            address.state_district ||
            address.county ||
            address.city ||
            address.town
          const readableAddress = [locality, district]
            .filter((part, index, parts) => part && parts.indexOf(part) === index)
            .join(', ')
          const fallbackAddress = result.display_name
            ?.split(',')
            .slice(0, 3)
            .map((part) => part.trim())
            .filter(Boolean)
            .join(', ')
          const resolvedAddress = readableAddress || fallbackAddress
          if (!resolvedAddress) {
            throw new Error('No readable address was found for this location.')
          }
          setLocationDraft(resolvedAddress)
          chooseLocation(resolvedAddress, true)
        } catch (lookupError) {
          setLocationError(
            lookupError.message ||
              'Could not convert your location to an address. Enter it manually.',
          )
        } finally {
          setIsDetectingLocation(false)
        }
      },
      (geoError) => {
        setIsDetectingLocation(false)
        setLocationError(
          geoError.code === geoError.PERMISSION_DENIED
            ? 'Location permission was denied. You can enter your address instead.'
            : 'Could not detect your location. Please enter it instead.',
        )
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const selectDishSuggestion = (entry) => {
    setQuery(entry.food.name)
    const previousSearches = getSearchHistory()
    localStorage.setItem(
      SEARCH_HISTORY_KEY,
      JSON.stringify([
        entry.food.name,
        ...previousSearches.filter((search) => search !== entry.food.name),
      ].slice(0, 10)),
    )
    setIsSearchOpen(false)
    onOpenFeed(entry.reel)
  }

  const selectCravingSuggestion = (craving) => {
    setQuery(craving)
    const previousSearches = getSearchHistory()
    localStorage.setItem(
      SEARCH_HISTORY_KEY,
      JSON.stringify([craving, ...previousSearches.filter((entry) => entry !== craving)].slice(0, 10)),
    )
    setIsSearchOpen(false)
  }

  const changePoster = (direction) => {
    setActivePosterIndex((index) =>
      (index + direction + posters.length) % posters.length,
    )
  }

  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-md bg-white pb-20 text-neutral-900">
      <header className="relative z-30 border-b border-white/15 bg-[#FF6600]/90 px-3 py-2 text-white shadow-sm backdrop-blur-md">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-lg font-extrabold tracking-tight">Biteflow</span>
          <div className="flex min-w-0 items-center gap-2">
            {isLocationExpanded && location && (
              <span className="max-w-[200px] truncate rounded-full border border-white/20 bg-black/30 px-2.5 py-1.5 text-xs font-semibold backdrop-blur-md">
                {location}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setLocationDraft(location)
                setLocationError('')
                setIsEditingLocation(!location)
                setIsLocationPromptOpen(true)
              }}
              className="grid size-9 shrink-0 place-items-center rounded-full border border-white/20 bg-white/20 text-white"
              aria-label={location ? `View delivery location: ${location}` : 'Set delivery location'}
            >
              <MapPin size={18} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1" ref={searchWrapperRef}>
            <label className="flex items-center gap-2 rounded-full border border-orange-500/20 bg-white/85 px-4 py-2.5 text-neutral-800 shadow-sm backdrop-blur-md">
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setIsSearchOpen(true)
                }}
                onFocus={() => setIsSearchOpen(true)}
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-neutral-500"
                placeholder={SEARCH_PLACEHOLDERS[placeholderIndex]}
                aria-label="Search dishes"
                aria-expanded={isSearchOpen}
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="text-neutral-500"
                >
                  <X size={17} />
                </button>
              ) : (
                <Search size={19} className="shrink-0 text-orange-600" />
              )}
            </label>

            {isSearchOpen && (
              <div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-orange-500/20 bg-white/90 text-neutral-800 shadow-xl backdrop-blur-md">
                {matchingSuggestions.length > 0 && (
                  <div className="p-2">
                    <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                      Dishes
                    </p>
                    {matchingSuggestions.map((entry) => (
                      <button
                        key={entry.food.id}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectDishSuggestion(entry)}
                        className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-orange-50"
                      >
                        <img
                          src={entry.food.image_url || undefined}
                          alt=""
                          className="size-10 rounded-lg bg-orange-50 object-cover"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold">{entry.food.name}</span>
                          <span className="block truncate text-xs text-neutral-500">
                            {entry.food.restaurants?.name ?? ''}
                          </span>
                        </span>
                        <ChevronRight size={17} className="text-neutral-400" />
                      </button>
                    ))}
                  </div>
                )}
                {popularSuggestions.length > 0 && (
                  <div className="border-t border-orange-500/10 p-2">
                    <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                      Popular campus cravings
                    </p>
                    {popularSuggestions.map((craving) => (
                      <button
                        key={craving}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectCravingSuggestion(craving)}
                        className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm font-medium hover:bg-orange-50"
                      >
                        <Search size={15} className="text-orange-500" />
                        {craving}
                      </button>
                    ))}
                  </div>
                )}
                {!matchingSuggestions.length && !popularSuggestions.length && (
                  <p className="px-4 py-3 text-sm text-neutral-500">No suggestions found.</p>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setFoodMode((mode) => (mode === 'veg' ? 'non-veg' : 'veg'))}
            className={`flex h-7 w-[72px] shrink-0 items-center justify-center rounded-full px-1 text-[11px] font-semibold text-white transition-colors duration-300 ${
              foodMode === 'veg' ? 'bg-emerald-500' : 'bg-red-600'
            }`}
            aria-label={`Food filter: ${foodMode === 'veg' ? 'Veg' : 'Non-Veg'}, switch`}
            aria-pressed={foodMode === 'veg'}
          >
            <span className="transition-all duration-300">
              {foodMode === 'veg' ? 'Veg' : 'Non-Veg'}
            </span>
          </button>
        </div>
      </header>

      <section className="pt-4">
        <div
          className="mx-4 overflow-hidden rounded-2xl border border-orange-500/20 bg-white/85 shadow-sm backdrop-blur-md"
          onTouchStart={(event) => {
            touchStartXRef.current = event.touches[0]?.clientX ?? null
          }}
          onTouchEnd={(event) => {
            const startX = touchStartXRef.current
            const endX = event.changedTouches[0]?.clientX
            if (startX === null || endX === undefined || Math.abs(endX - startX) < 40) return
            changePoster(endX < startX ? 1 : -1)
            touchStartXRef.current = null
          }}
        >
          {loading ? (
            <div className="h-48 animate-pulse bg-orange-50 sm:h-56" />
          ) : error ? (
            <p className="grid h-48 place-items-center px-5 text-center text-sm text-neutral-600 sm:h-56">{error}</p>
          ) : posters.length ? (
            <div className="relative h-48 sm:h-56">
              <div
                className="flex h-full transition-transform duration-500 ease-out"
                style={{ transform: `translateX(-${visiblePosterIndex * 100}%)` }}
              >
                {posters.map((reel, index) => (
                  <button
                    key={reel.id ?? index}
                    type="button"
                    onClick={() => onOpenFeed(reel)}
                    className="relative h-full w-full min-w-full snap-center overflow-hidden bg-[#1E1E24] text-left text-white"
                  >
                    {reel.thumbnail_url && (
                      <img src={reel.thumbnail_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    )}
                    <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                    <span className="absolute inset-x-4 bottom-4">
                      <span className="block text-xs font-bold text-orange-200">Featured Bite</span>
                      <span className="mt-1 block truncate text-xl font-extrabold">
                        {reel.food_item?.name || reel.title}
                      </span>
                      {reel.food_item?.restaurants?.name && (
                        <span className="mt-1 block text-sm text-white/85">
                          {reel.food_item.restaurants.name}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid h-48 place-items-center text-sm text-neutral-500 sm:h-56">
              No featured Bites available.
            </div>
          )}
        </div>
        {posters.length > 0 && (
          <div className="mt-3 flex justify-center gap-1.5">
            {posters.map((reel, index) => (
              <button
                key={reel.id ?? index}
                type="button"
                onClick={() => setActivePosterIndex(index)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  index === visiblePosterIndex ? 'w-6 bg-[#FF6600]' : 'w-2 bg-gray-300'
                }`}
                aria-label={`Show poster ${index + 1}`}
                aria-current={index === visiblePosterIndex ? 'true' : undefined}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-5">
        <div className="flex gap-2 overflow-x-auto px-4 pb-1">
          <button
            type="button"
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-orange-500/20 bg-white/85 px-3.5 py-2 text-xs font-bold text-neutral-800 shadow-sm backdrop-blur-md"
          >
            <Filter size={14} className="text-orange-600" />
            Filter
          </button>
          {CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() =>
                setSelectedCategory((current) => (current === category ? '' : category))
              }
              className={`shrink-0 rounded-full border px-4 py-2 text-xs font-semibold shadow-sm backdrop-blur-md transition ${
                selectedCategory === category
                  ? 'border-orange-500/30 bg-orange-500/15 text-orange-800'
                  : 'border-orange-500/20 bg-white/85 text-neutral-700'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between px-4">
          <h2 className="text-lg font-extrabold">Trending Bites</h2>
          <button
            type="button"
            onClick={() => filteredReels[0] && onOpenFeed(filteredReels[0])}
            className="text-xs font-bold text-[#FF6600]"
            disabled={!filteredReels.length}
          >
            See all
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto px-4 pb-2">
          {filteredReels.slice(0, 10).map((reel, index) => (
            <button
              key={reel.id ?? index}
              type="button"
              onClick={() => onOpenFeed(reel)}
              className="relative aspect-[9/16] w-36 shrink-0 overflow-hidden rounded-2xl border border-white/15 bg-[#1E1E24] text-left text-white"
            >
              {reel.thumbnail_url && (
                <img src={reel.thumbnail_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
              )}
              <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
              <span className="absolute inset-x-3 bottom-3">
                <span className="mb-1 block truncate text-[11px] font-semibold text-orange-200">
                  @{(reel.food_item?.restaurants?.name || reel.creator?.name || 'User').replace(/\s+/g, '_')}
                </span>
                <span className="line-clamp-2 block text-sm font-bold">
                  {reel.food_item?.name || reel.title}
                </span>
              </span>
            </button>
          ))}
          {!loading && !filteredReels.length && (
            <p className="rounded-2xl border border-orange-500/20 bg-white/85 px-4 py-5 text-sm text-neutral-500 shadow-sm backdrop-blur-md">
              No Bites match these filters.
            </p>
          )}
        </div>
      </section>

      <section className="mt-6 pb-5">
        <div className="mb-3 flex items-center justify-between px-4">
          <h2 className="text-lg font-extrabold">Recommended Dishes</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 px-4">
          {filteredDishes.map(({ food, reel }) => (
            <article
              key={food.id}
              className="overflow-hidden rounded-2xl border border-orange-500/20 bg-white/85 shadow-sm backdrop-blur-md"
            >
              <button
                type="button"
                onClick={() => onOpenFeed(reel)}
                className="relative block aspect-[4/3] w-full bg-orange-50"
                aria-label={`Watch ${food.name}`}
              >
                {food.image_url && (
                  <img src={food.image_url} alt={food.name} className="h-full w-full object-cover" />
                )}
              </button>
              <div className="p-3">
                <h3 className="line-clamp-1 text-sm font-bold">{food.name}</h3>
                <p className="mt-0.5 truncate text-xs text-neutral-500">
                  {food.restaurants?.name ?? ''}
                </p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-extrabold text-[#FF6600]">₹{food.price}</span>
                  <button
                    type="button"
                    onClick={() => onOrder(reel)}
                    className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-[#FF6600] px-3 text-xs font-bold text-white transition hover:bg-orange-600"
                    aria-label={`Order ${food.name}`}
                  >
                    <ShoppingBag size={14} />
                    Add
                  </button>
                </div>
              </div>
            </article>
          ))}
          {!loading && !filteredDishes.length && (
            <p className="col-span-2 rounded-2xl border border-orange-500/20 bg-white/85 px-4 py-5 text-center text-sm text-neutral-500 shadow-sm backdrop-blur-md">
              No dishes match these filters.
            </p>
          )}
        </div>
      </section>

      {isLocationPromptOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-3 backdrop-blur-sm sm:items-center"
          onClick={() => {
            if (location) setIsLocationPromptOpen(false)
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="location-title"
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md rounded-3xl border border-orange-500/15 bg-white p-5 text-neutral-900 shadow-2xl"
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-orange-600">Biteflow delivery</p>
                <h2 id="location-title" className="mt-1 text-xl font-extrabold">
                  Delivery location
                </h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Your campus or hostel address helps with local recommendations.
                </p>
              </div>
              {location && (
                <button
                  type="button"
                  onClick={() => setIsLocationPromptOpen(false)}
                  aria-label="Close location prompt"
                  className="rounded-full bg-orange-50 p-2 text-neutral-700"
                >
                  <X size={18} />
                </button>
              )}
            </div>
            {location && !isEditingLocation && (
              <div className="flex items-center gap-3 rounded-xl border border-orange-500/15 bg-orange-50/70 px-3.5 py-3">
                <MapPin size={18} className="shrink-0 text-orange-600" />
                <p className="min-w-0 flex-1 text-sm font-semibold text-neutral-800">
                  {location}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setLocationDraft(location)
                    setIsEditingLocation(true)
                  }}
                  className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-orange-700"
                  aria-label="Edit address"
                >
                  <Pencil size={15} />
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={detectLocation}
              disabled={isDetectingLocation}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-orange-500/20 bg-[#FFF6F0] py-3 text-sm font-bold transition hover:bg-orange-50 disabled:opacity-60"
            >
              <LocateFixed size={18} className="text-orange-600" />
              {isDetectingLocation ? 'Detecting location…' : 'Detect my location'}
            </button>
            {(isEditingLocation || !location) && (
              <>
                <div className="my-4 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                  <span className="h-px flex-1 bg-orange-500/15" />or enter manually<span className="h-px flex-1 bg-orange-500/15" />
                </div>
                <label className="block text-xs font-semibold text-neutral-700" htmlFor="campus-location">
                  Campus / hostel address
                </label>
                <input
                  id="campus-location"
                  value={locationDraft}
                  onChange={(event) => setLocationDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') chooseLocation(locationDraft)
                  }}
                  placeholder="Hostel, campus, or nearby landmark"
                  className="mt-2 w-full rounded-xl border border-orange-500/20 bg-white px-3.5 py-3 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-orange-400"
                />
              </>
            )}
            {locationError && <p role="alert" className="mt-2 text-xs text-red-600">{locationError}</p>}
            {(isEditingLocation || !location) && (
              <button
                type="button"
                onClick={() => chooseLocation(locationDraft)}
                className="mt-4 w-full rounded-xl bg-[#FF6600] py-3 text-sm font-extrabold text-white"
              >
                Save location
              </button>
            )}
          </section>
        </div>
      )}

      {locationToast && (
        <div
          role="status"
          className="fixed left-1/2 top-20 z-[60] -translate-x-1/2 rounded-full border border-white/15 bg-black/75 px-4 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur-md"
        >
          {locationToast}
        </div>
      )}
    </main>
  )
}

export default Home
