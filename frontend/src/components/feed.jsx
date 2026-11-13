import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Bookmark,
  CircleUserRound,
  MessageSquareText,
  Music,
  ShoppingBag,
  Send,
  ThumbsUp,
  X,
  Eye,
  EyeOff,
  Plus,
  Minus,
} from 'lucide-react'
import UploadScreen from './UploadScreen.jsx'
import Home from './Home.jsx'
import Profile from './Profile.jsx'

const FEED_URL = 'https://crispy-waffle-7vjrgrx67pww2w55w-8000.app.github.dev/feed'
const API_ORIGIN = 'https://crispy-waffle-7vjrgrx67pww2w55w-8000.app.github.dev'

function getAuthHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

async function requestInteraction(videoId, action, token, query = '') {
  const url = `${API_ORIGIN}/video/${encodeURIComponent(videoId)}/${action}${query}`
  let response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders(token),
    })
  } catch (requestError) {
    if (requestError.name === 'AbortError') throw requestError
    throw new Error(
      `Could not reach the Biteflow API at ${API_ORIGIN}. Check your connection and server CORS settings.`,
      { cause: requestError },
    )
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    const error = new Error(
      data.detail || data.error || `Could not ${action} this Bite (${response.status}).`,
    )
    error.status = response.status
    throw error
  }

  return response
}

function Reel({ item, index, onRequireAuth, onVisible, onOrder }) {
  const sectionRef = useRef(null)
  const videoRef = useRef(null)
  const likeIconRef = useRef(null)
  const userPausedRef = useRef(false)
  const tapTimeoutRef = useRef(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isLiked, setIsLiked] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [isCommentOpen, setIsCommentOpen] = useState(false)
  const [commentDraft, setCommentDraft] = useState('')
  const [commentCount, setCommentCount] = useState(item.total_comments ?? 0)
  const [interactionError, setInteractionError] = useState('')
  const [busyAction, setBusyAction] = useState('')
  const [shareError, setShareError] = useState('')

  useEffect(() => {
    const section = sectionRef.current
    const video = videoRef.current
    if (!section || !video) return undefined

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !userPausedRef.current) {
          onVisible(index)
          video.play().catch((error) => {
            console.error('Unable to play reel video', error)
          })
        } else {
          video.pause()
        }
      },
      { threshold: 0.6 },
    )

    observer.observe(section)
    return () => observer.disconnect()
  }, [index, onVisible])

  useEffect(() => () => clearTimeout(tapTimeoutRef.current), [])

  const food = item.food_item
  const restaurantName =
    food?.restaurants?.name ??
    item.restaurant?.name ??
    item.restaurant_name ??
    item.creator?.name ??
    ''
  const dishName = food?.name ?? ''
  const price = food?.price
  const likeCount = (item.total_likes ?? item.likes ?? 0) + (isLiked ? 1 : 0)
  const rating = food?.rating || '4.5'
  const prepTime = food?.prep_time || 48
  const audioName = item.audio_name || 'music apna - apna.........'

  const togglePlayback = () => {
    const video = videoRef.current
    if (!video) return

    if (video.paused) {
      userPausedRef.current = false
      video.play().catch((error) => {
        console.error('Unable to play reel video', error)
      })
    } else {
      userPausedRef.current = true
      video.pause()
    }
  }

  const handleVideoTap = () => {
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current)
      tapTimeoutRef.current = null
      setIsMuted((muted) => !muted)
      return
    }

    tapTimeoutRef.current = setTimeout(() => {
      tapTimeoutRef.current = null
      togglePlayback()
    }, 300)
  }

  const animateLike = () => {
    likeIconRef.current?.animate(
      [
        { transform: 'scale(1)' },
        { transform: 'scale(1.25)' },
        { transform: 'scale(1)' },
      ],
      { duration: 300, easing: 'ease-out' },
    )
  }

  const requireAuth = (type, run) => {
    onRequireAuth({
      type,
      reel: item,
      run: async (token) => {
        setBusyAction(type)
        setInteractionError('')
        try {
          await run(token)
        } finally {
          setBusyAction('')
        }
      },
      onError: (error) => {
        setInteractionError(error.message || 'Unable to complete this action.')
        console.error(`Unable to ${type} reel`, error)
      },
    })
  }

  const likeVideo = () => {
    if (isLiked || busyAction) return
    requireAuth('like', async (token) => {
      await requestInteraction(item.id, 'like', token)
      setIsLiked(true)
      animateLike()
    })
  }

  const saveVideo = () => {
    if (isSaved || busyAction) return
    requireAuth('save', async (token) => {
      await requestInteraction(item.id, 'save', token)
      setIsSaved(true)
    })
  }

  const submitComment = (event) => {
    event.preventDefault()
    const comment = commentDraft.trim()
    if (!comment || busyAction) return

    requireAuth('comment', async (token) => {
      await requestInteraction(
        item.id,
        'comment',
        token,
        `?comment=${encodeURIComponent(comment)}`,
      )
      setCommentCount((count) => count + 1)
      setCommentDraft('')
    })
  }

  const orderDish = () => {
    onOrder(item)
  }

  const openComments = () => {
    requireAuth('comment', async () => setIsCommentOpen(true))
  }

  const shareReel = async () => {
    setShareError('')
    const shareData = {
      title: item.title ?? dishName,
      text: item.description ?? '',
      url: window.location.href,
    }

    try {
      if (navigator.share) {
        await navigator.share(shareData)
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareData.url)
      } else {
        throw new Error('Sharing and clipboard access are unavailable in this browser.')
      }
      const token = localStorage.getItem('biteflow_token')
      if (token) await requestInteraction(item.id, 'share', token)
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Unable to share reel', error)
        setShareError(error.message || 'Unable to share this reel.')
      }
    }
  }

  return (
    <section
      ref={sectionRef}
      data-reel-index={index}
      className="relative flex h-[100dvh] w-full snap-start snap-always flex-col justify-between overflow-hidden bg-black text-white"
      aria-label={item.title || dishName || 'Video reel'}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        src={item.video_url}
        poster={item.thumbnail_url || undefined}
        autoPlay
        loop
        muted={isMuted}
        playsInline
        onClick={handleVideoTap}
        aria-label={item.title || dishName || 'Reel video'}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/35" />

      <header className="relative z-20 mx-3 mt-3 flex items-center justify-between rounded-2xl border border-white/25 bg-black/30 px-2.5 py-1.5 text-white shadow-lg backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-3">
          <img
            src={food?.image_url || undefined}
            alt=""
            className="h-14 w-14 shrink-0 rounded-xl object-cover sm:h-16 sm:w-16"
          />
          <div className="min-w-0">
            {dishName && (
              <p className="truncate text-sm font-bold leading-tight">{dishName}</p>
            )}
            {price != null && (
              <p className="text-xs font-semibold text-orange-300">
                {price} Rs
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="flex items-center gap-1 rounded-md bg-[#22C55E] px-1.5 py-0.5 text-[11px] font-extrabold text-white">
            {rating} ★
          </span>
          <span className="rounded-md bg-[#FDBA74] px-1.5 py-0.5 text-[11px] font-extrabold text-[#431407]">
            {prepTime} Mins
          </span>
        </div>
      </header>

      <div className="mt-auto relative z-20 flex w-full flex-col">
        <div className="max-w-[75%] px-3.5 text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-black">
              <CircleUserRound size={25} />
            </span>
            {restaurantName && (
              <span className="truncate text-sm font-bold">
                @{restaurantName.replace(/\s+/g, '_')}
              </span>
            )}
          </div>
          {item.description && (
            <p className="line-clamp-3 text-xs leading-relaxed text-white/95">
              {item.description}
            </p>
          )}
        </div>
        <footer className="relative z-20 mx-2.5 mb-2.5 flex items-center justify-between gap-3 rounded-lg bg-[#FDE68A]/95 px-3.5 py-2 text-neutral-900 shadow">
          <span className="truncate text-xs font-semibold">{audioName}</span>
          <Music size={18} className="shrink-0" />
        </footer>
      </div>

      <aside className="absolute right-3 bottom-20 z-20 flex flex-col items-center gap-4 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          <button
            type="button"
            onClick={orderDish}
            disabled={Boolean(busyAction)}
            className="flex flex-col items-center gap-1 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Order"
          >
            <span className="grid size-12 place-items-center rounded-full bg-[#FF6600] text-white shadow-lg shadow-orange-950/60 ring-2 ring-white/80">
              <ShoppingBag size={25} strokeWidth={2.5} />
            </span>
            <span className="text-[11px] font-bold">Order</span>
          </button>
          <button
            type="button"
            onClick={likeVideo}
            disabled={Boolean(busyAction) || isLiked}
            className="flex flex-col items-center"
            aria-label={isLiked ? 'Unlike' : 'Like'}
            aria-pressed={isLiked}
          >
            <ThumbsUp
              ref={likeIconRef}
              className={`h-7 w-7 transition-transform duration-200 active:scale-90 ${
                isLiked
                  ? 'drop-shadow-[0_0_8px_rgba(255,102,0,0.6)]'
                  : ''
              }`}
              fill="none"
              stroke={isLiked ? '#FF6600' : 'currentColor'}
            />
            <span className="mt-0.5 text-[11px] font-semibold">Like</span>
            <span className={`text-[10px] ${isLiked ? 'font-bold text-[#FF6600]' : ''}`}>
              {likeCount}
            </span>
          </button>
          <button
            type="button"
            onClick={openComments}
            className="flex flex-col items-center"
            aria-label="Comment"
          >
            <MessageSquareText size={28} />
            <span className="mt-0.5 text-[11px] font-semibold">comment</span>
            <span className="text-[10px]">{commentCount}</span>
          </button>
          <button
            type="button"
            onClick={shareReel}
            className="flex flex-col items-center"
            aria-label="Share"
          >
            <Send size={28} />
            <span className="mt-0.5 text-[11px] font-semibold">Share</span>
          </button>
          <button
            type="button"
            onClick={saveVideo}
            disabled={Boolean(busyAction) || isSaved}
            className="flex flex-col items-center"
            aria-label={isSaved ? 'Saved' : 'Save'}
            aria-pressed={isSaved}
          >
            <Bookmark size={28} fill={isSaved ? 'currentColor' : 'none'} />
            <span className="mt-0.5 text-[11px] font-semibold">Save</span>
          </button>
      </aside>

      {isCommentOpen && (
        <div className="absolute inset-0 z-30 flex items-end bg-black/45">
          <section
            className="w-full rounded-t-2xl bg-white p-4 text-neutral-900"
            role="dialog"
            aria-modal="true"
            aria-label="Comments"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold">Comments</h2>
              <button
                type="button"
                onClick={() => setIsCommentOpen(false)}
                className="grid size-8 place-items-center rounded-full"
                aria-label="Close comments"
              >
                <X size={20} />
              </button>
            </div>
            <p className="mb-3 text-sm text-neutral-500">
              {item.total_comments ?? 0} comments
            </p>
            <label className="sr-only" htmlFor={`comment-${item.id}`}>
              Write a comment
            </label>
            <textarea
              id={`comment-${item.id}`}
              rows={3}
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
              placeholder="Add a comment..."
              className="w-full resize-none rounded-lg border border-neutral-300 p-3 text-sm outline-none focus:border-orange-500"
            />
            <form onSubmit={submitComment} className="mt-3 flex justify-end">
              <button
                type="submit"
                disabled={!commentDraft.trim() || busyAction === 'comment'}
                className="rounded-full bg-orange-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {busyAction === 'comment' ? 'Sending…' : 'Post comment'}
              </button>
            </form>
          </section>
        </div>
      )}

      {(shareError || interactionError) && (
        <p role="alert" className="absolute bottom-20 left-3 right-16 z-30 rounded-lg bg-black/80 p-2 text-xs text-white">
          {interactionError || shareError}
        </p>
      )}
    </section>
  )
}

function AuthModal({ onClose, onAuthenticated }) {
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setNotice('')

    const isRegister = mode === 'register'
    const [firstName, ...lastNameParts] = name.trim().split(/\s+/)
    const payload = isRegister
      ? {
          first_name: firstName,
          last_name: lastNameParts.join(' ') || null,
          email: email.trim(),
          phone: phone.trim(),
          password,
        }
      : { email: email.trim(), password }

    try {
      const response = await fetch(
        `${API_ORIGIN}/auth/${isRegister ? 'register' : 'login'}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      const data = await response.json().catch(() => ({}))

      if (!response.ok || data.error) {
        const detail = Array.isArray(data.detail)
          ? data.detail
              .map((entry) => `${entry.loc?.slice(-1)[0] ?? 'Field'}: ${entry.msg}`)
              .join(' ')
          : data.detail
        throw new Error(detail || data.error || `Request failed (${response.status}).`)
      }

      const token = data.access_token || data.token
      if (!token) {
        if (isRegister) {
          setMode('login')
          setNotice('Account created. Log in to continue.')
          return
        }
        throw new Error('The server did not return an authentication token.')
      }

      await onAuthenticated(token)
    } catch (requestError) {
      setError(requestError.message || 'Unable to authenticate. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <section
        className="w-full max-w-md rounded-t-3xl border border-white/15 bg-neutral-950/95 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 text-white shadow-2xl shadow-black/50"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-sheet-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 id="auth-sheet-title" className="text-xl font-extrabold">
              Welcome to Biteflow
            </h2>
            <p className="mt-1 text-sm text-white/60">Sign in to keep going</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full bg-white/10"
            aria-label="Close login"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mb-5 grid grid-cols-2 rounded-xl bg-white/5 p-1">
          <button
            type="button"
            onClick={() => {
              setMode('login')
              setError('')
              setNotice('')
            }}
            className={`rounded-lg py-2.5 text-sm font-bold ${
              mode === 'login' ? 'bg-[#FF6600] text-white' : 'text-white/65'
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register')
              setError('')
              setNotice('')
            }}
            className={`rounded-lg py-2.5 text-sm font-bold ${
              mode === 'register' ? 'bg-[#FF6600] text-white' : 'text-white/65'
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3.5">
          {mode === 'register' && (
            <>
              <label className="block text-xs font-semibold text-white/70">
                Name
                <input
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#FF6600]"
                  placeholder="Your name"
                />
              </label>
              <label className="block text-xs font-semibold text-white/70">
                Phone number
                <input
                  autoComplete="tel"
                  inputMode="numeric"
                  pattern="[0-9]{10}"
                  maxLength={10}
                  required
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#FF6600]"
                  placeholder="10-digit phone number"
                />
              </label>
            </>
          )}
          <label className="block text-xs font-semibold text-white/70">
            Email
            <input
              autoComplete="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#FF6600]"
              placeholder="you@example.com"
            />
          </label>
          <label className="block text-xs font-semibold text-white/70">
            Password
            <span className="relative mt-1.5 block">
              <input
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                type={showPassword ? 'text' : 'password'}
                minLength={6}
                maxLength={100}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-3 pr-12 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#FF6600]"
                placeholder="At least 6 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute inset-y-0 right-3 grid place-items-center text-white/55"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>

          {(error || notice) && (
            <p
              role={error ? 'alert' : 'status'}
              className={`rounded-lg px-3 py-2 text-sm ${
                error ? 'bg-red-500/10 text-red-300' : 'bg-green-500/10 text-green-300'
              }`}
            >
              {error || notice}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-[#FF6600] py-3.5 text-sm font-extrabold text-white transition-colors hover:bg-orange-500 disabled:cursor-wait disabled:opacity-60"
          >
            {submitting
              ? 'Please wait…'
              : mode === 'login'
                ? 'Login'
                : 'Create account'}
          </button>
        </form>
      </section>
    </div>
  )
}

function OrderSheet({ reel, onClose, onRequireAuth, onSuccess }) {
  const [quantity, setQuantity] = useState(1)
  const [deliveryNote, setDeliveryNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const food = reel?.food_item
  const price = Number(food?.price ?? 0)
  const restaurantName =
    food?.restaurants?.name ?? reel?.restaurant?.name ?? reel?.restaurant_name ?? ''

  const placeOrder = () => {
    setSubmitting(true)
    setError('')
    onRequireAuth({
      type: 'order',
      reel,
      run: async (token) => {
        try {
          let response
          try {
            response = await fetch(`${API_ORIGIN}/orders`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                food_item_id: reel.food_item_id ?? food?.id,
                video_id: reel.id ?? null,
                quantity,
                delivery_note: deliveryNote.trim(),
              }),
            })
          } catch (requestError) {
            throw new Error(
              `Could not reach the Biteflow API at ${API_ORIGIN}. Check your connection and server CORS settings.`,
              { cause: requestError },
            )
          }
          const data = await response.json().catch(() => ({}))
          if (!response.ok) {
            const detail = Array.isArray(data.detail)
              ? data.detail.map((entry) => entry.msg).join(' ')
              : data.detail || data.error
            const orderError = new Error(
              detail || `Order failed (${response.status}).`,
            )
            orderError.status = response.status
            throw orderError
          }
          onSuccess()
        } catch (requestError) {
          setSubmitting(false)
          throw requestError
        }
      },
      onError: (requestError) => {
        setSubmitting(false)
        setError(requestError.message || 'Unable to place this order.')
      },
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <section
        className="w-full max-w-md rounded-t-3xl border border-white/20 bg-neutral-950/95 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 text-white shadow-2xl shadow-black/50"
        role="dialog"
        aria-modal="true"
        aria-label="Order dish"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-extrabold">Your order</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full bg-white/10"
            aria-label="Close order"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-3">
          <img
            src={food?.image_url || reel.thumbnail_url || undefined}
            alt=""
            className="size-16 shrink-0 rounded-xl bg-white/10 object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold">{food?.name || reel.title}</p>
            <p className="mt-0.5 truncate text-xs text-white/60">
              @{restaurantName.replace(/\s+/g, '_')}
            </p>
            <p className="mt-1 text-sm font-bold text-orange-300">₹{price}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm font-semibold text-white/75">Quantity</span>
          <div className="flex items-center gap-4 rounded-full bg-white/10 p-1">
            <button
              type="button"
              onClick={() => setQuantity((current) => Math.max(1, current - 1))}
              disabled={quantity <= 1}
              className="grid size-9 place-items-center rounded-full text-white disabled:opacity-40"
              aria-label="Decrease quantity"
            >
              <Minus size={17} />
            </button>
            <span className="min-w-4 text-center font-bold">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((current) => Math.min(10, current + 1))}
              disabled={quantity >= 10}
              className="grid size-9 place-items-center rounded-full bg-[#FF6600] text-white disabled:opacity-40"
              aria-label="Increase quantity"
            >
              <Plus size={17} />
            </button>
          </div>
        </div>

        <label className="mt-4 block text-sm font-semibold text-white/75">
          Delivery location / note
          <textarea
            rows={2}
            value={deliveryNote}
            onChange={(event) => setDeliveryNote(event.target.value)}
            placeholder="Hostel / Gate / Special instructions..."
            className="mt-2 w-full resize-none rounded-xl border border-white/15 bg-white/5 px-3.5 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#FF6600]"
          />
        </label>

        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={placeOrder}
          disabled={submitting || !reel.food_item_id && !food?.id}
          className="mt-4 w-full rounded-xl bg-[#FF6600] py-3.5 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Placing order…' : `Place Order • ₹${price * quantity}`}
        </button>
      </section>
    </div>
  )
}

function Feed({ activeTab, onActiveTabChange, createRequest }) {
  const [reels, setReels] = useState([])
  const [nextOffset, setNextOffset] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [paginationError, setPaginationError] = useState('')
  const [token, setToken] = useState(() => localStorage.getItem('biteflow_token'))
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [activeOrderReel, setActiveOrderReel] = useState(null)
  const [orderToast, setOrderToast] = useState('')
  const requestedOffsetsRef = useRef(new Set())
  const loadingMoreRef = useRef(false)
  const previousTabRef = useRef('home')
  const onVisibleReel = useCallback((index) => setActiveIndex(index), [])

  const openBites = (target = 0) => {
    const index = typeof target === 'number'
      ? target
      : reels.findIndex((reel) => reel.id === target?.id)
    onActiveTabChange('feed')
    setActiveIndex(Math.max(index, 0))
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-reel-index="${Math.max(index, 0)}"]`)
        ?.scrollIntoView({ behavior: 'instant', block: 'start' })
    })
  }

  const executeAction = useCallback(async (action, authToken) => {
    try {
      await action.run(authToken)
    } catch (actionError) {
      if (actionError.status === 401) {
        localStorage.removeItem('biteflow_token')
        setToken(null)
        setPendingAction(action)
        setIsAuthModalOpen(true)
      } else {
        action.onError(actionError)
      }
    }
  }, [])

  const requireAuth = useCallback((action) => {
    const currentToken = token || localStorage.getItem('biteflow_token')
    if (!currentToken) {
      setPendingAction(action)
      setIsAuthModalOpen(true)
      return
    }
    void executeAction(action, currentToken)
  }, [executeAction, token])

  const handleAuthenticated = async (authToken) => {
    localStorage.setItem('biteflow_token', authToken)
    setToken(authToken)
    setIsAuthModalOpen(false)
    const action = pendingAction
    setPendingAction(null)
    if (action) await executeAction(action, authToken)
  }

  const openUpload = useCallback(() => {
    requireAuth({
      type: 'upload',
      reel: null,
      run: () => {
        previousTabRef.current = activeTab
        onActiveTabChange('upload')
        setUploadOpen(true)
      },
      onError: (actionError) => setError(actionError.message),
    })
  }, [activeTab, onActiveTabChange, requireAuth])

  const openOrder = (reel) => {
    requireAuth({
      type: 'order',
      reel,
      run: () => setActiveOrderReel(reel),
      onError: (actionError) => setPaginationError(actionError.message),
    })
  }

  const closeUpload = () => {
    setUploadOpen(false)
    onActiveTabChange(previousTabRef.current === 'feed' ? 'feed' : previousTabRef.current)
  }

  const closeOrderWithToast = () => {
    setActiveOrderReel(null)
    setOrderToast('Order placed successfully!')
    window.setTimeout(() => setOrderToast(''), 2800)
  }

  useEffect(() => {
    const controller = new AbortController()

    async function fetchFeed() {
      try {
        const response = await fetch(`${FEED_URL}?limit=5&offset=0`, {
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error(`The feed request failed (${response.status}).`)
        }
        const data = await response.json()
        if (!Array.isArray(data.items)) {
          throw new Error('The feed response did not contain an items list.')
        }
        setReels(data.items)
        setNextOffset(data.next_offset ?? null)
        setHasMore(Boolean(data.has_more))
      } catch (requestError) {
        if (!controller.signal.aborted && requestError.name !== 'AbortError') {
          setError(requestError.message || 'Unable to load the feed.')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    fetchFeed()
    return () => controller.abort()
  }, [])

  const handledCreateRequestRef = useRef(0)
  useEffect(() => {
    if (createRequest > handledCreateRequestRef.current) {
      handledCreateRequestRef.current = createRequest
      openUpload()
    }
  }, [createRequest, openUpload])

  useEffect(() => {
    if (
      !hasMore ||
      loading ||
      loadingMoreRef.current ||
      activeIndex < reels.length - 2
    ) {
      return
    }

    const offset = nextOffset ?? reels.length
    if (requestedOffsetsRef.current.has(offset)) return

    const controller = new AbortController()
    requestedOffsetsRef.current.add(offset)
    loadingMoreRef.current = true
    setLoadingMore(true)
    setPaginationError('')

    async function fetchMore() {
      try {
        const response = await fetch(
          `${FEED_URL}?limit=5&offset=${encodeURIComponent(offset)}`,
          { signal: controller.signal },
        )
        if (!response.ok) {
          throw new Error(`Could not load more Bites (${response.status}).`)
        }
        const data = await response.json()
        if (!Array.isArray(data.items)) {
          throw new Error('The feed response did not contain an items list.')
        }
        setReels((current) => [...current, ...data.items])
        setNextOffset(data.next_offset ?? null)
        setHasMore(Boolean(data.has_more))
      } catch (requestError) {
        if (!controller.signal.aborted) {
          requestedOffsetsRef.current.delete(offset)
          setPaginationError(requestError.message || 'Could not load more Bites.')
        }
      } finally {
        if (!controller.signal.aborted) {
          loadingMoreRef.current = false
          setLoadingMore(false)
        }
      }
    }

    fetchMore()
    return () => controller.abort()
  }, [activeIndex, hasMore, loading, nextOffset, reels.length])

  return (
    <>
      {activeTab === 'home' && (
        <Home
          reels={reels}
          loading={loading}
          error={error}
          onOpenFeed={openBites}
          onOrder={openOrder}
        />
      )}
      {activeTab === 'profile' && (
        <Profile
          token={token}
          onLogin={() => setIsAuthModalOpen(true)}
          onCreate={openUpload}
          reels={reels}
          onOpenBites={openBites}
          onOrder={openOrder}
        />
      )}
      {activeTab === 'feed' && (
        loading ? (
          <main className="mx-auto flex h-[100dvh] w-full max-w-md items-center justify-center bg-black">
            <span className="size-9 animate-spin rounded-full border-4 border-white/25 border-t-orange-500" role="status" aria-label="Loading Bites" />
          </main>
        ) : error ? (
          <main className="mx-auto flex h-[100dvh] w-full max-w-md flex-col items-center justify-center gap-3 bg-black px-8 text-center text-white">
            <p className="font-semibold">Unable to load Bites</p>
            <p className="text-sm text-white/75">{error}</p>
          </main>
        ) : reels.length === 0 ? (
          <main className="mx-auto flex h-[100dvh] w-full max-w-md items-center justify-center bg-black px-8 text-center text-white/75">
            No Bites are available.
          </main>
        ) : (
          <main className="mx-auto w-full max-w-md bg-black">
            {reels.map((item, index) => (
              <Reel
                key={item.id ?? index}
                item={item}
                index={index}
                onRequireAuth={requireAuth}
                onVisible={onVisibleReel}
                onOrder={openOrder}
              />
            ))}
            {(loadingMore || paginationError) && (
              <div className="fixed bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full bg-black/80 px-4 py-2 text-xs text-white">
                {loadingMore ? 'Loading more Bites…' : paginationError}
              </div>
            )}
          </main>
        )
      )}
      {uploadOpen && (
        <UploadScreen
          token={token}
          onClose={closeUpload}
          onPosted={(bite) => {
            setReels((current) => [bite, ...current])
            setUploadOpen(false)
            onActiveTabChange('feed')
            setActiveIndex(0)
            setNextOffset((current) =>
              current === null ? null : current + 1,
            )
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        />
      )}
      {activeOrderReel && (
        <OrderSheet
          reel={activeOrderReel}
          onClose={() => setActiveOrderReel(null)}
          onRequireAuth={requireAuth}
          onSuccess={closeOrderWithToast}
        />
      )}
      {orderToast && (
        <div
          role="status"
          className="fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 whitespace-nowrap rounded-full bg-neutral-900/95 px-4 py-2.5 text-sm font-semibold text-white shadow-xl"
        >
          {orderToast}
        </div>
      )}
      {isAuthModalOpen && (
        <AuthModal
          onClose={() => {
            setIsAuthModalOpen(false)
            setPendingAction(null)
          }}
          onAuthenticated={handleAuthenticated}
        />
      )}
    </>
  )
}

export default Feed
