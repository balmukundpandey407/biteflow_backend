import { useEffect, useRef, useState } from 'react'
import {
  Bookmark,
  CircleUserRound,
  MessageSquareText,
  Music,
  ShoppingBag,
  Send,
  ThumbsUp,
  X,
} from 'lucide-react'

const FEED_URL = 'https://crispy-waffle-7vjrgrx67pww2w55w-8000.app.github.dev/feed'
const API_ORIGIN = new URL(FEED_URL).origin

function getAuthHeaders() {
  const token =
    localStorage.getItem('access_token') ||
    localStorage.getItem('token')

  if (!token) {
    throw new Error('Please log in to interact with reels.')
  }

  return { Authorization: `Bearer ${token}` }
}

async function requestInteraction(videoId, action, query = '') {
  const url = `${API_ORIGIN}/video/${encodeURIComponent(videoId)}/${action}${query}`
  const response = await fetch(url, { headers: getAuthHeaders() })

  if (!response.ok) {
    throw new Error(`Could not ${action} this reel (${response.status}).`)
  }

  return response
}

function Reel({ item }) {
  const sectionRef = useRef(null)
  const videoRef = useRef(null)
  const likeIconRef = useRef(null)
  const userPausedRef = useRef(false)
  const tapTimeoutRef = useRef(null)
  const [isMuted, setIsMuted] = useState(true)
  const [isLiked, setIsLiked] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [isCommentOpen, setIsCommentOpen] = useState(false)
  const [commentDraft, setCommentDraft] = useState('')
  const [commentCount, setCommentCount] = useState(item.total_comments ?? 0)
  const [interactionError, setInteractionError] = useState('')
  const [pendingAction, setPendingAction] = useState('')
  const [shareError, setShareError] = useState('')

  useEffect(() => {
    const section = sectionRef.current
    const video = videoRef.current
    if (!section || !video) return undefined

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !userPausedRef.current) {
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
  }, [])

  useEffect(() => () => clearTimeout(tapTimeoutRef.current), [])

  const food = item.food_item
  const restaurantName =
    food?.restaurants?.name ??
    item.restaurant?.name ??
    item.restaurant_name ??
    item.creator?.name ??
    ''
  const phone = food?.restaurants?.phone ?? item.restaurant?.phone ?? item.phone
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

  const likeVideo = async () => {
    if (isLiked || pendingAction) return

    setPendingAction('like')
    setInteractionError('')
    try {
      await requestInteraction(item.id, 'like')
      setIsLiked(true)
      animateLike()
    } catch (error) {
      setInteractionError(error.message)
      console.error('Unable to like reel', error)
    } finally {
      setPendingAction('')
    }
  }

  const saveVideo = async () => {
    if (isSaved || pendingAction) return

    setPendingAction('save')
    setInteractionError('')
    try {
      await requestInteraction(item.id, 'save')
      setIsSaved(true)
    } catch (error) {
      setInteractionError(error.message)
      console.error('Unable to save reel', error)
    } finally {
      setPendingAction('')
    }
  }

  const submitComment = async (event) => {
    event.preventDefault()
    const comment = commentDraft.trim()
    if (!comment || pendingAction) return

    setPendingAction('comment')
    setInteractionError('')
    try {
      await requestInteraction(
        item.id,
        'comment',
        `?comment=${encodeURIComponent(comment)}`,
      )
      setCommentCount((count) => count + 1)
      setCommentDraft('')
    } catch (error) {
      setInteractionError(error.message)
      console.error('Unable to comment on reel', error)
    } finally {
      setPendingAction('')
    }
  }

  const orderDish = () => {
    if (!phone) return
    const message = `Hi, I want to order ${dishName} (${price} Rs)`
    window.open(
      `https://wa.me/${encodeURIComponent(phone)}?text=${encodeURIComponent(message)}`,
      '_blank',
      'noopener,noreferrer',
    )
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
      await requestInteraction(item.id, 'share')
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
            className="h-10 w-10 shrink-0 rounded-xl object-cover"
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
            disabled={!phone}
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
            disabled={Boolean(pendingAction) || isLiked}
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
            onClick={() => setIsCommentOpen(true)}
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
            disabled={Boolean(pendingAction) || isSaved}
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
                disabled={!commentDraft.trim() || pendingAction === 'comment'}
                className="rounded-full bg-orange-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {pendingAction === 'comment' ? 'Sending…' : 'Post comment'}
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

function Feed() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    async function fetchFeed() {
      try {
        const response = await fetch(FEED_URL, { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`The feed request failed (${response.status}).`)
        }
        const data = await response.json()
        const feedItems = Array.isArray(data)
          ? data
          : data.items || data.videos || data.feed || []
        setItems(Array.isArray(feedItems) ? feedItems : [])
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

  if (loading) {
    return (
      <div className="mx-auto flex h-[100dvh] w-full max-w-md items-center justify-center bg-black">
        <span
          className="size-9 animate-spin rounded-full border-4 border-white/25 border-t-orange-500"
          role="status"
          aria-label="Loading feed"
        />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto flex h-[100dvh] w-full max-w-md flex-col items-center justify-center gap-3 bg-black px-8 text-center text-white">
        <p className="font-semibold">Unable to load reels</p>
        <p className="text-sm text-white/75">{error}</p>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto flex h-[100dvh] w-full max-w-md items-center justify-center bg-black px-8 text-center text-white/75">
        No reels are available.
      </div>
    )
  }

  return (
    <main className="mx-auto w-full max-w-md bg-black">
      {items.map((item, index) => (
        <Reel key={item.id ?? index} item={item} />
      ))}
    </main>
  )
}

export default Feed
