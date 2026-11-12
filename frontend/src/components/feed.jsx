import { useEffect, useRef, useState } from 'react'
import {
  Bookmark,
  CheckCircle2,
  CircleUserRound,
  MessageSquareText,
  Music,
  Send,
  ThumbsUp,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'

const FEED_URL = 'https://crispy-waffle-7vjrgrx67pww2w55w-8000.app.github.dev/feed'

function Reel({ item }) {
  const sectionRef = useRef(null)
  const videoRef = useRef(null)
  const likeIconRef = useRef(null)
  const userPausedRef = useRef(false)
  const [isMuted, setIsMuted] = useState(true)
  const [isLiked, setIsLiked] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [isCommentOpen, setIsCommentOpen] = useState(false)
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

  const toggleLike = () => {
    const willLike = !isLiked
    setIsLiked(willLike)
    if (willLike) {
      likeIconRef.current?.animate(
        [
          { transform: 'scale(1)' },
          { transform: 'scale(1.25)' },
          { transform: 'scale(1)' },
        ],
        { duration: 300, easing: 'ease-out' },
      )
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
        onClick={togglePlayback}
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

      <button
        type="button"
        onClick={() => setIsMuted((muted) => !muted)}
        className="absolute right-3 top-[5.5rem] z-20 grid size-8 place-items-center rounded-full bg-black/45 text-white"
        aria-label={isMuted ? 'Unmute video' : 'Mute video'}
      >
        {isMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
      </button>

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
            className="flex flex-col items-center disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Order"
          >
            <CheckCircle2 size={28} />
            <span className="mt-0.5 text-[11px] font-semibold">Order</span>
          </button>
          <button
            type="button"
            onClick={toggleLike}
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
              fill={isLiked ? '#FF6600' : 'none'}
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
            {item.total_comments != null && (
              <span className="text-[10px]">{item.total_comments}</span>
            )}
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
            onClick={() => setIsSaved((saved) => !saved)}
            className="flex flex-col items-center"
            aria-label={isSaved ? 'Remove saved bookmark' : 'Save'}
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
              placeholder="Add a comment..."
              className="w-full resize-none rounded-lg border border-neutral-300 p-3 text-sm outline-none focus:border-orange-500"
            />
          </section>
        </div>
      )}

      {shareError && (
        <p role="alert" className="absolute bottom-20 left-3 right-16 z-30 text-xs text-white">
          {shareError}
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
