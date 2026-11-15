import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  Volume2,
  VolumeX,
  Play,
  Pause,
} from 'lucide-react'
import UploadScreen from './UploadScreen.jsx'
import Home from './Home.jsx'
import Profile from './Profile.jsx'
import Settings from './Settings.jsx'
import { API_BASE_URL } from '../api.js'
import { getDeliveryEtaMinutes } from '../utils/eta.js'

const FEED_URL = `${API_BASE_URL}/feed`
const VEG_VALUES = ['true', '1', 'yes', 'veg', 'vegetarian']

function isVegetarian(value) {
  return VEG_VALUES.includes(String(value ?? '').toLowerCase())
}

function getAuthHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

async function requestInteraction(videoId, action, token, query = '', method = 'GET') {
  const basePath = method === 'DELETE' ? 'videos' : 'video'
  const url = `${API_BASE_URL}/${basePath}/${encodeURIComponent(videoId)}/${action}${query}`
  let response
  try {
    response = await fetch(url, {
      method,
      headers: getAuthHeaders(token),
    })
  } catch (requestError) {
    if (requestError.name === 'AbortError') throw requestError
    throw new Error("Couldn't complete that right now. Please try again.", {
      cause: requestError,
    })
  }

  if (!response.ok) {
    const body = await response.text()
    console.error(`Biteflow ${action} request failed: HTTP ${response.status}`, body)
    const error = new Error("Couldn't complete that right now. Please try again.")
    error.status = response.status
    throw error
  }

  return response
}

function Reel({ item, index, isActive, onRequireAuth, onVisible, onOrder, onDishOpen }) {
  const sectionRef = useRef(null)
  const videoRef = useRef(null)
  const likeIconRef = useRef(null)
  const userPausedRef = useRef(false)
  const tapTimeoutRef = useRef(null)
  const feedbackTimeoutRef = useRef(null)
  const timelineRef = useRef(null)
  const [isVisible, setIsVisible] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [feedback, setFeedback] = useState('')
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isLiked, setIsLiked] = useState(Boolean(item.is_liked))
  const [isSaved, setIsSaved] = useState(Boolean(item.is_saved))
  const [isCommentOpen, setIsCommentOpen] = useState(false)
  const [commentDraft, setCommentDraft] = useState('')
  const [comments, setComments] = useState([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentsError, setCommentsError] = useState('')
  const [likeCount, setLikeCount] = useState(item.total_likes ?? item.likes ?? 0)
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
        const isCurrentSection = entry.intersectionRatio >= 0.6
        setIsVisible(isCurrentSection)
        if (isCurrentSection) {
          onVisible(index)
        } else {
          setCurrentTime(0)
        }
      },
      { threshold: 0.6 },
    )

    observer.observe(section)
    return () => observer.disconnect()
  }, [index, onVisible])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (isVisible && isActive && !userPausedRef.current) {
      video.play().catch((error) => {
        console.error('Unable to play reel video', error)
      })
    } else {
      video.pause()
      if (!isVisible) {
        video.currentTime = 0
      }
    }
  }, [isActive, isVisible])

  useEffect(() => () => {
    clearTimeout(tapTimeoutRef.current)
    clearTimeout(feedbackTimeoutRef.current)
    videoRef.current?.pause()
  }, [])

  useEffect(() => {
    if (!interactionError && !shareError) return undefined
    const timeoutId = window.setTimeout(() => {
      setInteractionError('')
      setShareError('')
    }, 2800)
    return () => window.clearTimeout(timeoutId)
  }, [interactionError, shareError])

  useEffect(() => {
    if (!isCommentOpen) return undefined
    const controller = new AbortController()
    const token = localStorage.getItem('biteflow_token')
    async function loadComments() {
      setCommentsLoading(true)
      setCommentsError('')
      try {
        const response = await fetch(
          `${API_BASE_URL}/videos/${encodeURIComponent(item.id)}/comments`,
          {
            headers: token ? getAuthHeaders(token) : {},
            signal: controller.signal,
          },
        )
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.detail || 'Comments are unavailable.')
        const items = Array.isArray(data) ? data : data.items || data.comments || []
        setComments(items)
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setCommentsError("Couldn't load comments right now. Please try again.")
          console.error('Unable to load Bite comments', requestError)
        }
      } finally {
        if (!controller.signal.aborted) setCommentsLoading(false)
      }
    }

    void loadComments()
    return () => controller.abort()
  }, [isCommentOpen, item.id])

  const food = item.food_item
  const restaurantName =
    food?.restaurants?.name ??
    item.restaurant?.name ??
    item.restaurant_name ??
    item.creator?.name ??
    ''
  const dishName = food?.name ?? ''
  const price = food?.price
  const rating = food?.rating || '4.5'
  const eta = getDeliveryEtaMinutes(
    food?.restaurants ?? item.restaurant,
  )
  const audioName = item.audio_name || 'music apna - apna.........'

  const togglePlayback = () => {
    const video = videoRef.current
    if (!video) return

    if (video.paused) {
      userPausedRef.current = false
      setFeedback('play')
      video.play().catch((error) => {
        console.error('Unable to play reel video', error)
      })
    } else {
      userPausedRef.current = true
      setFeedback('pause')
      video.pause()
    }
    clearTimeout(feedbackTimeoutRef.current)
    feedbackTimeoutRef.current = window.setTimeout(() => setFeedback(''), 600)
  }

  const handleVideoTap = () => {
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current)
      tapTimeoutRef.current = null
      toggleMute()
      return
    }

    tapTimeoutRef.current = setTimeout(() => {
      tapTimeoutRef.current = null
      togglePlayback()
    }, 300)
  }

  const toggleMute = () => {
    setIsMuted((muted) => !muted)
    setFeedback('volume')
    clearTimeout(feedbackTimeoutRef.current)
    feedbackTimeoutRef.current = window.setTimeout(() => setFeedback(''), 600)
  }

  const seekToPointer = (event) => {
    const video = videoRef.current
    const timeline = timelineRef.current
    if (!video || !timeline || !Number.isFinite(video.duration)) return
    const bounds = timeline.getBoundingClientRect()
    const progress = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width))
    video.currentTime = progress * video.duration
    setCurrentTime(video.currentTime)
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
        setInteractionError("Couldn't complete that right now. Please try again.")
        console.error(`Unable to ${type} reel`, error)
      },
    })
  }

  const likeVideo = () => {
    if (busyAction) return
    const shouldLike = !isLiked
    requireAuth('like', async (token) => {
      setIsLiked(shouldLike)
      setLikeCount((count) => Math.max(0, count + (shouldLike ? 1 : -1)))
      try {
        await requestInteraction(
          item.id,
          'like',
          token,
          '',
          shouldLike ? 'GET' : 'DELETE',
        )
        if (shouldLike) animateLike()
      } catch (requestError) {
        setIsLiked(!shouldLike)
        setLikeCount((count) => Math.max(0, count + (shouldLike ? -1 : 1)))
        throw requestError
      }
    })
  }

  const saveVideo = () => {
    if (busyAction) return
    const shouldSave = !isSaved
    requireAuth('save', async (token) => {
      setIsSaved(shouldSave)
      try {
        await requestInteraction(
          item.id,
          'save',
          token,
          '',
          shouldSave ? 'GET' : 'DELETE',
        )
      } catch (requestError) {
        setIsSaved(!shouldSave)
        throw requestError
      }
    })
  }

  const submitComment = (event) => {
    event.preventDefault()
    const comment = commentDraft.trim()
    if (!comment || busyAction) return

    requireAuth('comment', async (token) => {
      const response = await fetch(
        `${API_BASE_URL}/videos/${encodeURIComponent(item.id)}/comments`,
        {
          method: 'POST',
          headers: getAuthHeaders(token),
          body: JSON.stringify({ comment_text: comment }),
        },
      )
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        const error = new Error("Couldn't complete that right now. Please try again.")
        error.status = response.status
        throw error
      }
      if (data.comment) setComments((current) => [data.comment, ...current])
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
        setShareError("Couldn't complete that right now. Please try again.")
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
        loop
        muted={isMuted}
        playsInline
        preload="metadata"
        onClick={handleVideoTap}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onSeeked={(event) => setCurrentTime(event.currentTarget.currentTime)}
        aria-label={item.title || dishName || 'Reel video'}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/35" />

      <div
        className={`pointer-events-none absolute left-1/2 top-1/2 z-20 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/40 bg-white/25 text-white shadow-xl backdrop-blur-md transition-all duration-[600ms] ${
          feedback === 'play' || feedback === 'pause'
            ? 'scale-100 opacity-100'
              : 'scale-75 opacity-0'
        }`}
        aria-hidden="true"
      >
        {feedback === 'play' ? <Play size={30} fill="white" /> : <Pause size={30} fill="white" />}
      </div>
      <div
        className={`pointer-events-none absolute left-1/2 top-[58%] z-20 grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/40 bg-white/25 text-white shadow-xl backdrop-blur-md transition-all duration-[600ms] ${
          feedback === 'volume' ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
        }`}
        aria-hidden="true"
      >
        {isMuted ? <VolumeX size={23} /> : <Volume2 size={23} />}
      </div>

      <button
        type="button"
        onClick={toggleMute}
        className="absolute right-3 top-3 z-20 grid size-10 place-items-center rounded-full border border-white/25 bg-black/35 text-white shadow-lg backdrop-blur-md"
        aria-label={isMuted ? 'Unmute video' : 'Mute video'}
      >
        {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
      </button>

      <button
        type="button"
        onClick={() => onDishOpen(item)}
        className="relative z-20 mx-3 mt-3 flex items-center justify-between rounded-2xl border border-white/25 bg-black/30 px-2.5 py-1.5 pr-14 text-left text-white shadow-lg backdrop-blur-md"
        aria-label={`View ${dishName || item.title} dish details`}
      >
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
            {eta} Mins
          </span>
        </div>
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
            disabled={Boolean(busyAction)}
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
            disabled={Boolean(busyAction)}
            className="flex flex-col items-center"
            aria-label={isSaved ? 'Saved' : 'Save'}
            aria-pressed={isSaved}
          >
            <Bookmark size={28} fill={isSaved ? 'currentColor' : 'none'} />
            <span className="mt-0.5 text-[11px] font-semibold">Save</span>
          </button>
      </aside>

      <div
        ref={timelineRef}
        role="slider"
        tabIndex={0}
        aria-label="Video timeline"
        aria-valuemin={0}
        aria-valuemax={Math.floor(duration)}
        aria-valuenow={Math.floor(currentTime)}
        className="absolute inset-x-0 bottom-0 z-30 h-2 touch-none cursor-pointer bg-white/35"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          seekToPointer(event)
        }}
        onPointerMove={(event) => {
          if (event.buttons === 1) seekToPointer(event)
        }}
        onKeyDown={(event) => {
          const video = videoRef.current
          if (!video || !duration) return
          if (event.key === 'ArrowRight') video.currentTime = Math.min(duration, video.currentTime + 5)
          if (event.key === 'ArrowLeft') video.currentTime = Math.max(0, video.currentTime - 5)
        }}
      >
        <div
          className="h-full bg-[#FF6600]"
          style={{ width: `${duration ? Math.min((currentTime / duration) * 100, 100) : 0}%` }}
        />
      </div>

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
              {commentCount} comments
            </p>
            <div className="mb-3 max-h-[35vh] space-y-3 overflow-y-auto">
              {commentsLoading ? (
                <p className="py-4 text-center text-sm text-neutral-500">Loading comments…</p>
              ) : commentsError ? (
                <p role="status" className="py-4 text-center text-sm text-neutral-500">
                  {commentsError}
                </p>
              ) : comments.length ? (
                comments.map((comment) => (
                  <article key={comment.id} className="border-b border-neutral-100 pb-2">
                    <p className="text-xs font-bold">
                      {comment.user_name ||
                        `${comment.user?.first_name || ''} ${comment.user?.last_name || ''}`.trim() ||
                        'Biteflow member'}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-700">
                      {comment.comment_text || comment.content}
                    </p>
                    {comment.created_at && (
                      <time className="mt-1 block text-[10px] text-neutral-400">
                        {new Date(comment.created_at).toLocaleString()}
                      </time>
                    )}
                  </article>
                ))
              ) : (
                <p className="py-4 text-center text-sm text-neutral-500">
                  Be the first to comment.
                </p>
              )}
            </div>
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
        <p role="status" className="absolute bottom-20 left-3 right-16 z-30 rounded-full bg-black/80 px-3 py-2 text-center text-xs text-white">
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
        `${API_BASE_URL}/auth/${isRegister ? 'register' : 'login'}`,
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/10 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <section
        className="w-full max-w-md rounded-t-3xl border border-gray-200 bg-white px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 text-[#1F2937] shadow-2xl shadow-black/20"
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
            <p className="mt-1 text-sm text-gray-500">Sign in to keep going</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full bg-gray-100"
            aria-label="Close login"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mb-5 grid grid-cols-2 rounded-xl bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => {
              setMode('login')
              setError('')
              setNotice('')
            }}
            className={`rounded-lg py-2.5 text-sm font-bold ${
              mode === 'login' ? 'bg-[#FF6600] text-white' : 'text-gray-600'
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
              mode === 'register' ? 'bg-[#FF6600] text-white' : 'text-gray-600'
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3.5">
          {mode === 'register' && (
            <>
              <label className="block text-xs font-semibold text-gray-700">
                Name
                <input
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm text-[#1F2937] outline-none placeholder:text-gray-400 focus:border-[#FF6600]"
                  placeholder="Your name"
                />
              </label>
              <label className="block text-xs font-semibold text-gray-700">
                Phone number
                <input
                  autoComplete="tel"
                  inputMode="numeric"
                  pattern="[0-9]{10}"
                  maxLength={10}
                  required
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm text-[#1F2937] outline-none placeholder:text-gray-400 focus:border-[#FF6600]"
                  placeholder="10-digit phone number"
                />
              </label>
            </>
          )}
          <label className="block text-xs font-semibold text-gray-700">
            Email
            <input
              autoComplete="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm text-[#1F2937] outline-none placeholder:text-gray-400 focus:border-[#FF6600]"
              placeholder="you@example.com"
            />
          </label>
          <label className="block text-xs font-semibold text-gray-700">
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
                className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 pr-12 text-sm text-[#1F2937] outline-none placeholder:text-gray-400 focus:border-[#FF6600]"
                placeholder="At least 6 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute inset-y-0 right-3 grid place-items-center text-gray-500"
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
  const [selectedInstructions, setSelectedInstructions] = useState([])
  const [deliveryAddressMode, setDeliveryAddressMode] = useState(() =>
    localStorage.getItem('biteflow_location') ? 'current' : 'manual',
  )
  const [manualAddress, setManualAddress] = useState('')
  const savedAddress = localStorage.getItem('biteflow_location') || ''
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const food = reel?.food_item
  const price = Number(food?.price ?? 0)
  const restaurantName =
    food?.restaurants?.name ?? reel?.restaurant?.name ?? reel?.restaurant_name ?? ''
  const eta = getDeliveryEtaMinutes(food?.restaurants ?? reel?.restaurant)
  const vegValue = String(food?.is_veg ?? '').toLowerCase()
  const isVeg = ['true', '1', 'yes', 'veg', 'vegetarian'].includes(vegValue)
  const isNonVeg = ['false', '0', 'no', 'non-veg', 'nonveg'].includes(vegValue)

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
            response = await fetch(`${API_BASE_URL}/orders`, {
              method: 'POST',
              headers: getAuthHeaders(token),
              body: JSON.stringify({
                food_item_id: reel.food_item_id ?? food?.id,
                video_id: reel.id ?? null,
                quantity,
                delivery_note: [...selectedInstructions, deliveryNote.trim()]
                  .filter(Boolean)
                  .join(', '),
                delivery_address:
                  deliveryAddressMode === 'current'
                    ? savedAddress
                    : manualAddress.trim(),
              }),
            })
          } catch (requestError) {
            throw new Error("Couldn't complete that right now. Please try again.", {
              cause: requestError,
            })
          }
          const body = await response.text()
          if (!response.ok) {
            console.error(`Biteflow order request failed: HTTP ${response.status}`, body)
            const orderError = new Error("Couldn't complete that right now. Please try again.")
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
        setError("Couldn't complete that right now. Please try again.")
        console.error('Unable to place Bite order', requestError)
      },
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/10 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <section
        className="h-[55vh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-white/60 bg-white/80 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 text-[#1F2937] shadow-2xl backdrop-blur-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Order dish"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-neutral-400/50" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-extrabold">Dish details</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full bg-white/70"
            aria-label="Close order"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-white/50 bg-white/55 p-3">
          <img
            src={food?.image_url || reel.thumbnail_url || undefined}
            alt=""
            className="size-20 shrink-0 rounded-xl bg-white/70 object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold">{food?.name || reel.title}</p>
            <p className="mt-0.5 truncate text-xs text-neutral-500">
              @{restaurantName.replace(/\s+/g, '_')}
            </p>
            <p className="mt-1 text-sm font-bold text-[#FF6600]">₹{price}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-full px-2.5 py-1 font-bold ${
            isVeg ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
          }`}>{isVeg ? 'Veg' : isNonVeg ? 'Non-Veg' : 'Veg status unavailable'}</span>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 font-bold text-amber-900">
            {food?.rating || '4.5'} ★
          </span>
          <span className="rounded-full bg-orange-100 px-2.5 py-1 font-bold text-orange-900">
            {eta} Mins
          </span>
        </div>
        {reel.description && (
          <p className="mt-3 text-sm leading-relaxed text-neutral-600">{reel.description}</p>
        )}

        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm font-semibold text-neutral-700">Quantity</span>
          <div className="flex items-center gap-4 rounded-full bg-white/70 p-1">
            <button
              type="button"
              onClick={() => setQuantity((current) => Math.max(1, current - 1))}
              disabled={quantity <= 1}
              className="grid size-9 place-items-center rounded-full text-neutral-700 disabled:opacity-40"
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

        <fieldset className="mt-4 space-y-2">
          <legend className="mb-2 text-sm font-semibold text-neutral-700">
            Deliver To
          </legend>
          {savedAddress && (
            <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${
              deliveryAddressMode === 'current'
                ? 'border-[#FF6600] bg-orange-50/80'
                : 'border-white/60 bg-white/55'
            }`}>
              <input
                type="radio"
                name="delivery-address"
                value="current"
                checked={deliveryAddressMode === 'current'}
                onChange={() => setDeliveryAddressMode('current')}
                className="mt-0.5 accent-[#FF6600]"
              />
              <span className="min-w-0">
                <span className="block text-sm font-bold">Current detected location</span>
                <span className="mt-0.5 block text-xs text-neutral-600">{savedAddress}</span>
              </span>
            </label>
          )}
          <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${
            deliveryAddressMode === 'manual'
              ? 'border-[#FF6600] bg-orange-50/80'
              : 'border-white/60 bg-white/55'
          }`}>
            <input
              type="radio"
              name="delivery-address"
              value="manual"
              checked={deliveryAddressMode === 'manual'}
              onChange={() => setDeliveryAddressMode('manual')}
              className="accent-[#FF6600]"
            />
            <span className="text-sm font-bold">+ Add Manual Address</span>
          </label>
          {deliveryAddressMode === 'manual' && (
            <input
              required
              value={manualAddress}
              onChange={(event) => setManualAddress(event.target.value)}
              placeholder="Hostel, street, or landmark"
              className="w-full rounded-xl border border-white/60 bg-white/65 px-3.5 py-3 text-sm text-neutral-800 outline-none placeholder:text-neutral-400 focus:border-[#FF6600]"
            />
          )}
        </fieldset>

        <label className="mt-4 block text-sm font-semibold text-neutral-700">
          Cooking instructions
          <div className="mt-2 flex flex-wrap gap-2">
            {['Extra Cheese', 'Less Spicy', 'Extra Sauce'].map((instruction) => (
              <button
                key={instruction}
                type="button"
                onClick={() => setSelectedInstructions((current) =>
                  current.includes(instruction)
                    ? current.filter((entry) => entry !== instruction)
                    : [...current, instruction],
                )}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  selectedInstructions.includes(instruction)
                    ? 'border-[#FF6600] bg-orange-50 text-[#FF6600]'
                    : 'border-gray-200 bg-white/70 text-gray-600'
                }`}
                aria-pressed={selectedInstructions.includes(instruction)}
              >
                + {instruction}
              </button>
            ))}
          </div>
          <textarea
            rows={2}
            value={deliveryNote}
            onChange={(event) => setDeliveryNote(event.target.value)}
            placeholder="e.g., Extra cheese, less spicy, no onions..."
            className="mt-2 w-full resize-none rounded-xl border border-white/60 bg-white/65 px-3.5 py-3 text-sm text-neutral-800 outline-none placeholder:text-neutral-400 focus:border-[#FF6600]"
          />
        </label>

        {error && (
          <p role="status" className="fixed bottom-6 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-full bg-neutral-900/95 px-4 py-3 text-center text-sm font-semibold text-white shadow-xl">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={placeOrder}
          disabled={
            submitting ||
            (!reel.food_item_id && !food?.id) ||
            (deliveryAddressMode === 'manual' && !manualAddress.trim())
          }
          className="mt-4 w-full rounded-xl bg-[#FF6600] py-3.5 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Placing order…' : `Order Now • ₹${price * quantity}`}
        </button>
      </section>
    </div>
  )
}

function Feed({ activeTab, onActiveTabChange, createRequest }) {
  const [reels, setReels] = useState([])
  const [foodPreference, setFoodPreference] = useState('non-veg')
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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [activeOrderReel, setActiveOrderReel] = useState(null)
  const [orderToast, setOrderToast] = useState('')
  const requestedOffsetsRef = useRef(new Set())
  const loadingMoreRef = useRef(false)
  const previousTabRef = useRef('home')
  const onVisibleReel = useCallback((index) => setActiveIndex(index), [])
  const visibleReels = useMemo(
    () => foodPreference === 'veg'
      ? reels.filter((reel) => isVegetarian(reel.food_item?.is_veg))
      : reels,
    [foodPreference, reels],
  )
  const changeFoodPreference = (preference) => {
    setFoodPreference(preference)
    setActiveIndex(0)
  }

  const openBites = (target = 0) => {
    const index = typeof target === 'number'
      ? target
      : visibleReels.findIndex((reel) => reel.id === target?.id)
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
    setActiveOrderReel(reel)
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
          headers: token ? { Authorization: `Bearer ${token}` } : {},
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
  }, [token])

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
      activeIndex < visibleReels.length - 2
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
          {
            signal: controller.signal,
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          },
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
  }, [activeIndex, hasMore, loading, nextOffset, reels.length, token, visibleReels.length])

  return (
    <>
      {activeTab === 'home' && (
        <Home
          reels={reels}
          loading={loading}
          error={error}
          token={token}
          foodMode={foodPreference}
          onFoodModeChange={changeFoodPreference}
          onOpenFeed={openBites}
          onOrder={openOrder}
        />
      )}
      {activeTab === 'profile' && (
        <Profile
          token={token}
          onLogin={() => setIsAuthModalOpen(true)}
          onCreate={openUpload}
          onOpenSettings={() => setSettingsOpen(true)}
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
        ) :         visibleReels.length === 0 ? (
          <main className="mx-auto flex h-[100dvh] w-full max-w-md items-center justify-center bg-black px-8 text-center text-white/75">
            No Bites are available.
          </main>
        ) : (
          <main className="mx-auto w-full max-w-md bg-black">
            {visibleReels.map((item, index) => (
              <Reel
                key={item.id ?? index}
                item={item}
                index={index}
                isActive={index === activeIndex}
                onRequireAuth={requireAuth}
                onVisible={onVisibleReel}
                onOrder={openOrder}
                onDishOpen={openOrder}
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
      {uploadOpen && activeTab === 'upload' && (
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
      {settingsOpen && (
        <Settings
          token={token}
          onClose={() => setSettingsOpen(false)}
          onLogout={() => {
            localStorage.removeItem('biteflow_token')
            setToken(null)
            setSettingsOpen(false)
          }}
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
