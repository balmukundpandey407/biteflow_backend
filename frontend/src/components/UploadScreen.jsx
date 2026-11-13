import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Camera,
  Circle,
  Flashlight,
  Images,
  Music,
  Plus,
  RotateCcw,
  Timer,
  X,
} from 'lucide-react'

const API_ORIGIN = 'https://crispy-waffle-7vjrgrx67pww2w55w-8000.app.github.dev'
const RESTAURANTS_URL = `${API_ORIGIN}/restaurants`
const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/j37518cz/video/upload'
const VIDEO_FILTERS = [
  { name: 'Warm Food', shortName: 'Warm', css: 'saturate(1.2) sepia(0.12) hue-rotate(-8deg)' },
  { name: 'Crispy Contrast', shortName: 'Crispy', css: 'contrast(1.2) saturate(1.15)' },
  { name: 'Fresh Vibrant', shortName: 'Fresh', css: 'saturate(1.4) brightness(1.04)' },
  { name: 'Normal', shortName: 'Normal', css: 'none' },
]

function responseError(data, fallback) {
  if (Array.isArray(data?.detail)) {
    return data.detail.map((entry) => entry.msg).join(' ')
  }
  return data?.detail || data?.error || fallback
}

function CameraPreview({ stream, filter }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!ref.current || !stream) return
    ref.current.srcObject = stream
    ref.current.play().catch(() => {})
  }, [stream])

  return (
    <video
      ref={ref}
      className="absolute inset-0 h-full w-full object-cover"
      autoPlay
      muted
      playsInline
      style={{ filter }}
      aria-label="Live camera preview"
    />
  )
}

function UploadScreen({ token, onClose, onPosted }) {
  const cameraPreviewRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const countdownRef = useRef(null)
  const recordingTimerRef = useRef(null)
  const recordingStartedAtRef = useRef(0)
  const maxRecordingDurationRef = useRef(15)
  const countdownRemainingRef = useRef(0)
  const menuRequestRef = useRef(0)
  const fileInputRef = useRef(null)
  const musicInputRef = useRef(null)
  const musicObjectUrlRef = useRef('')
  const [cameraStream, setCameraStream] = useState(null)
  const [cameraError, setCameraError] = useState('')
  const [facingMode, setFacingMode] = useState('environment')
  const [flashEnabled, setFlashEnabled] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [countdown, setCountdown] = useState(0)
  const [countdownValue, setCountdownValue] = useState(null)
  const [recording, setRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [durationPreset, setDurationPreset] = useState('15')
  const [musicDuration, setMusicDuration] = useState(null)
  const [musicFileName, setMusicFileName] = useState('')
  const [filterIndex, setFilterIndex] = useState(0)
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const [restaurants, setRestaurants] = useState([])
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('')
  const [menuItems, setMenuItems] = useState([])
  const [selectedFoodItemId, setSelectedFoodItemId] = useState('')
  const [isAddingDish, setIsAddingDish] = useState(false)
  const [newDishName, setNewDishName] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [caption, setCaption] = useState('')
  const [loadingRestaurants, setLoadingRestaurants] = useState(false)
  const [loadingMenu, setLoadingMenu] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const maxDuration = durationPreset === 'music' && musicDuration
    ? musicDuration
    : Number(durationPreset)
  const activeFilter = VIDEO_FILTERS[filterIndex]
  const timelineProgress = Math.min((recordingDuration / maxDuration) * 100, 100)

  useEffect(() => {
    maxRecordingDurationRef.current = maxDuration
  }, [maxDuration])

  useEffect(() => {
    let active = true
    let localStream

    async function openCamera() {
      setCameraError('')
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Camera access is not available in this browser. Choose a video from your gallery.')
        return
      }

      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode } },
          audio: true,
        })
        if (!active) {
          localStream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = localStream
        setCameraStream(localStream)
      } catch (cameraRequestError) {
        if (active) {
          setCameraError(
            cameraRequestError.name === 'NotAllowedError'
              ? 'Camera permission was denied. Allow camera access or choose a video from your gallery.'
              : 'Unable to start the camera. Choose a video from your gallery instead.',
          )
        }
      }
    }

    openCamera()
    return () => {
      active = false
      localStream?.getTracks().forEach((track) => track.stop())
      if (streamRef.current === localStream) streamRef.current = null
    }
  }, [facingMode])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      if (countdownRef.current) clearInterval(countdownRef.current)
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      if (musicObjectUrlRef.current) URL.revokeObjectURL(musicObjectUrlRef.current)
    }
  }, [previewUrl])

  useEffect(() => {
    if (cameraPreviewRef.current) cameraPreviewRef.current.playbackRate = speed
  }, [speed, previewUrl])

  const selectedFood = menuItems.find((food) => food.id === selectedFoodItemId)

  const setVideoFile = (videoFile) => {
    if (!videoFile) return
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(videoFile)
    setPreviewUrl(URL.createObjectURL(videoFile))
    setShowDetails(false)
    setError('')
  }

  const chooseMusicFile = (event) => {
    const audioFile = event.target.files?.[0]
    event.target.value = ''
    if (!audioFile) return

    if (musicObjectUrlRef.current) URL.revokeObjectURL(musicObjectUrlRef.current)
    const objectUrl = URL.createObjectURL(audioFile)
    musicObjectUrlRef.current = objectUrl
    const audio = new Audio()
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
        setError('Could not read the selected music clip duration.')
        return
      }
      setMusicDuration(audio.duration)
      setMusicFileName(audioFile.name)
      setDurationPreset('music')
      setError('')
    }
    audio.onerror = () => {
      setError('Could not read the selected music clip.')
    }
    audio.src = objectUrl
  }

  const clearRecordingTimer = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
  }

  const startRecording = () => {
    if (!streamRef.current || recording || countdownValue !== null) return

    if (countdown > 0) {
      setCountdownValue(countdown)
      countdownRemainingRef.current = countdown
      countdownRef.current = setInterval(() => {
        countdownRemainingRef.current -= 1
        if (countdownRemainingRef.current <= 0) {
          clearInterval(countdownRef.current)
          countdownRef.current = null
          setCountdownValue(null)
          beginRecording()
          return
        }
        setCountdownValue(countdownRemainingRef.current)
      }, 1000)
      return
    }

    beginRecording()
  }

  const beginRecording = () => {
    const stream = streamRef.current
    if (!stream) return

    try {
      const mimeType = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
      ].find((candidate) => MediaRecorder.isTypeSupported(candidate))
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data)
      }
      recorder.onerror = (event) => {
        clearRecordingTimer()
        setError(event.error?.message || 'Recording failed.')
        setRecording(false)
      }
      recorder.onstop = () => {
        clearRecordingTimer()
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'video/webm',
        })
        if (blob.size) {
          setVideoFile(new File([blob], `bite-${Date.now()}.webm`, { type: blob.type }))
        }
        setRecording(false)
      }
      recorderRef.current = recorder
      recorder.start()
      recordingStartedAtRef.current = Date.now()
      setRecordingDuration(0)
      setRecording(true)
      recordingTimerRef.current = setInterval(() => {
        const elapsed = (Date.now() - recordingStartedAtRef.current) / 1000
        const limit = maxRecordingDurationRef.current
        setRecordingDuration(Math.min(elapsed, limit))
        if (elapsed >= limit && recorder.state === 'recording') {
          clearRecordingTimer()
          recorder.stop()
        }
      }, 100)
    } catch (recordingError) {
      setError(recordingError.message || 'This browser cannot record video.')
    }
  }

  const stopRecording = () => {
    clearRecordingTimer()
    if (recorderRef.current?.state === 'recording') {
      setRecordingDuration(
        Math.min(
          (Date.now() - recordingStartedAtRef.current) / 1000,
          maxRecordingDurationRef.current,
        ),
      )
      recorderRef.current.stop()
    }
  }

  const changeFilter = (direction) => {
    setFilterIndex(
      (current) =>
        (current + direction + VIDEO_FILTERS.length) % VIDEO_FILTERS.length,
    )
  }

  const chooseGalleryVideo = (event) => {
    const videoFile = event.target.files?.[0]
    setRecordingDuration(0)
    setVideoFile(videoFile)
    event.target.value = ''
  }

  const toggleFlash = async () => {
    const videoTrack = streamRef.current?.getVideoTracks()[0]
    if (!videoTrack) {
      setError('Flash is unavailable without an active camera.')
      return
    }
    try {
      const nextState = !flashEnabled
      await videoTrack.applyConstraints({ advanced: [{ torch: nextState }] })
      setFlashEnabled(nextState)
    } catch {
      setError('Flash is not supported by this camera.')
    }
  }

  const changeSpeed = () => {
    setSpeed((current) => (current === 1 ? 1.2 : 1))
  }

  const openDetails = async () => {
    setShowDetails(true)
    if (restaurants.length || loadingRestaurants) return
    setLoadingRestaurants(true)
    setError('')
    try {
      const response = await fetch(RESTAURANTS_URL)
      const data = await response.json()
      if (!response.ok) throw new Error(responseError(data, 'Could not load restaurants.'))
      const availableRestaurants = Array.isArray(data)
        ? data
        : data.data || data.items || data.restaurants || []
      setRestaurants(availableRestaurants)
      if (!availableRestaurants.length) setError('No restaurants are available.')
    } catch (restaurantError) {
      setError(restaurantError.message || 'Could not load restaurants.')
    } finally {
      setLoadingRestaurants(false)
    }
  }

  const selectRestaurant = async (restaurantId) => {
    const requestId = ++menuRequestRef.current
    setSelectedRestaurantId(restaurantId)
    setSelectedFoodItemId('')
    setMenuItems([])
    setIsAddingDish(false)
    setNewDishName('')
    setNewPrice('')
    setError('')
    if (!restaurantId) return

    setLoadingMenu(true)
    try {
      const response = await fetch(
        `${RESTAURANTS_URL}/${encodeURIComponent(restaurantId)}/menu`,
      )
      const data = await response.json()
      if (!response.ok) throw new Error(responseError(data, 'Could not load this menu.'))
      const menu = Array.isArray(data) ? data : data.data || data.items || data.menu || []
      if (requestId !== menuRequestRef.current) return
      setMenuItems(menu)
    } catch (menuError) {
      if (requestId !== menuRequestRef.current) return
      setError(menuError.message || 'Could not load this menu.')
    } finally {
      if (requestId === menuRequestRef.current) setLoadingMenu(false)
    }
  }

  const uploadToCloudinary = (videoFile) =>
    new Promise((resolve, reject) => {
      const formData = new FormData()
      formData.append('file', videoFile)
      formData.append('upload_preset', 'bites')

      const request = new XMLHttpRequest()
      request.open('POST', CLOUDINARY_URL)
      request.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setProgress(Math.round((event.loaded / event.total) * 90))
        }
      }
      request.onload = () => {
        let data
        try {
          data = JSON.parse(request.responseText)
        } catch {
          reject(new Error('Cloudinary returned an invalid response.'))
          return
        }
        if (request.status < 200 || request.status >= 300) {
          reject(new Error(data.error?.message || 'Video upload failed.'))
          return
        }
        resolve(data)
      }
      request.onerror = () => reject(new Error('Network error while uploading video.'))
      request.onabort = () => reject(new Error('Video upload was cancelled.'))
      request.send(formData)
    })

  const postBite = async (event) => {
    event.preventDefault()
    if (!file || !selectedRestaurantId) {
      setError('Choose a video and restaurant before posting your Bite.')
      return
    }
    if (!isAddingDish && !selectedFoodItemId) {
      setError('Choose an existing dish or add a new one.')
      return
    }
    if (isAddingDish && (!newDishName.trim() || newPrice === '' || Number(newPrice) < 0)) {
      setError('Enter a dish name and valid price.')
      return
    }
    if (!token) {
      setError('Your login session has expired. Close this screen and sign in again.')
      return
    }

    setUploading(true)
    setError('')
    setProgress(0)
    try {
      const cloudinaryData = await uploadToCloudinary(file)
      setProgress(92)
      const videoUrl = cloudinaryData.secure_url.replace(
        '/upload/',
        '/upload/f_auto,q_auto/',
      )
      const thumbnailUrl = cloudinaryData.secure_url.replace(
        '/upload/',
        '/upload/so_1,w_300,h_300,c_fill/',
      ).replace(/\.[^/.]+$/, '.jpg')
      const response = await fetch(`${API_ORIGIN}/videos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          restaurant_id: selectedRestaurantId,
          food_item_id: isAddingDish ? null : selectedFoodItemId,
          dish_name: isAddingDish ? newDishName.trim() : null,
          price: isAddingDish ? Number(newPrice) : null,
          description: caption.trim(),
          video_url: videoUrl,
          thumbnail_url: thumbnailUrl,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(responseError(data, `Could not post Bite (${response.status}).`))
      }
      setProgress(100)
      const selectedRestaurant = restaurants.find(
        (restaurant) => restaurant.id === selectedRestaurantId,
      )
      const postedFood = {
        ...(isAddingDish
          ? {
              id: data.food_item?.id,
              name: newDishName.trim(),
              price: Number(newPrice),
              image_url: thumbnailUrl,
            }
          : selectedFood),
        restaurants: {
          name: selectedRestaurant?.name,
          phone: selectedRestaurant?.phone,
        },
      }
      onPosted({
        id: data.id ?? data.video?.id,
        title: isAddingDish ? newDishName.trim() : selectedFood.name,
        description: caption.trim(),
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl,
        total_views: 0,
        total_likes: 0,
        total_comments: 0,
        food_item: postedFood,
      })
    } catch (uploadError) {
      setError(uploadError.message || 'Unable to post Bite.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between overflow-hidden bg-black text-white">
      <div
        className="absolute inset-x-0 top-0 z-40 h-1 bg-white/15"
        role="progressbar"
        aria-label="Recording duration"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(timelineProgress)}
      >
        <div
          className="h-full bg-[#FF6600] transition-[width] duration-100"
          style={{ width: `${timelineProgress}%` }}
        />
      </div>

      {previewUrl ? (
        <video
          ref={cameraPreviewRef}
          src={previewUrl}
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          loop
          muted
          playsInline
          style={{ playbackRate: speed, filter: activeFilter.css }}
        />
      ) : cameraStream ? (
        <CameraPreview stream={cameraStream} filter={activeFilter.css} />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
          <Camera size={44} className="text-white/60" />
          <p className="text-sm text-white/75">{cameraError || 'Starting camera…'}</p>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/35" />

      <header className="relative z-20 flex flex-col gap-3 px-4 pb-3 pt-6">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="grid size-10 place-items-center rounded-full bg-black/35"
            aria-label="Close upload"
          >
            <X size={23} />
          </button>
          <p className="text-xs font-bold text-white/85">
            {recording
              ? `${recordingDuration.toFixed(1)}s / ${maxDuration.toFixed(1)}s`
              : musicFileName || 'Choose a duration'}
          </p>
          <button
            type="button"
            onClick={() => musicInputRef.current?.click()}
            disabled={recording}
            className={`grid size-10 place-items-center rounded-full border ${
              musicFileName
                ? 'border-[#FF6600] bg-[#FF6600] text-white'
                : 'border-[#FF6600]/50 bg-[#FF6600]/25 text-white'
            }`}
            aria-label={musicFileName ? `Selected music: ${musicFileName}. Choose another clip` : 'Choose music clip'}
            title={musicFileName || 'Choose music'}
          >
            <Music size={19} />
          </button>
          <input
            ref={musicInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={chooseMusicFile}
          />
        </div>
        {!file && !showDetails && (
          <div className="flex items-center justify-center gap-2">
            {['15', '30', '60'].map((seconds) => (
              <button
                key={seconds}
                type="button"
                disabled={recording}
                onClick={() => setDurationPreset(seconds)}
                className={`rounded-full border px-3 py-1.5 text-xs font-bold backdrop-blur-md transition ${
                  durationPreset === seconds
                    ? 'border-[#FF6600] bg-[#FF6600]/80 text-white'
                    : 'border-white/25 bg-black/35 text-white/80'
                } disabled:opacity-50`}
                aria-pressed={durationPreset === seconds}
              >
                {seconds}s
              </button>
            ))}
            {musicDuration !== null && (
              <button
                type="button"
                disabled={recording}
                onClick={() => setDurationPreset('music')}
                className={`max-w-32 truncate rounded-full border px-3 py-1.5 text-xs font-bold backdrop-blur-md transition ${
                  durationPreset === 'music'
                    ? 'border-[#FF6600] bg-[#FF6600]/80 text-white'
                    : 'border-white/25 bg-black/35 text-white/80'
                } disabled:opacity-50`}
                aria-pressed={durationPreset === 'music'}
              >
                Music · {musicDuration.toFixed(1)}s
              </button>
            )}
          </div>
        )}
      </header>

      {!showDetails && !previewUrl && (
        <aside className="absolute right-4 top-1/3 z-20 flex flex-col gap-4">
          <button
            type="button"
            onClick={toggleFlash}
            className={`grid size-11 place-items-center rounded-full border border-[#FF6600]/50 bg-[#FF6600]/25 text-[#FF6600] ${
              flashEnabled ? 'bg-[#FF6600]/60 text-white' : ''
            }`}
            aria-label={flashEnabled ? 'Turn flash off' : 'Turn flash on'}
          >
            <Flashlight size={20} />
          </button>
          <button
            type="button"
            onClick={changeSpeed}
            className="grid size-11 place-items-center rounded-full border border-[#FF6600]/50 bg-[#FF6600]/25 text-xs font-bold text-white"
            aria-label={`Playback speed ${speed}x`}
          >
            {speed}x
          </button>
          <button
            type="button"
            onClick={() => setCountdown((current) => (current === 0 ? 3 : current === 3 ? 10 : 0))}
            className="grid size-11 place-items-center rounded-full border border-[#FF6600]/50 bg-[#FF6600]/25 text-white"
            aria-label={`Countdown ${countdown ? `${countdown} seconds` : 'off'}`}
          >
            <span className="flex flex-col items-center">
              <Timer size={19} />
              <span className="text-[9px]">{countdown || 'Off'}</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setFacingMode((mode) => (mode === 'environment' ? 'user' : 'environment'))}
            className="grid size-11 place-items-center rounded-full border border-[#FF6600]/50 bg-[#FF6600]/25 text-white"
            aria-label="Switch camera"
          >
            <RotateCcw size={21} />
          </button>
        </aside>
      )}

      {countdownValue !== null && (
        <div className="absolute inset-0 z-30 grid place-items-center text-7xl font-black text-white drop-shadow-lg">
          {countdownValue}
        </div>
      )}

      {!showDetails && (
        <div
          className={`absolute z-20 flex items-center ${
            file
              ? 'bottom-8 right-7'
              : 'inset-x-0 bottom-8 justify-around px-4'
          }`}
        >
          {!file && (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={recording}
                className="grid size-12 place-items-center rounded-full bg-[#FF6600]/25 text-white disabled:opacity-40"
                aria-label="Choose video from gallery"
              >
                <Images size={24} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={chooseGalleryVideo}
              />
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={recording ? stopRecording : startRecording}
                  disabled={!cameraStream || countdownValue !== null}
                  className="grid size-[76px] place-items-center rounded-full border-[5px] border-white bg-transparent disabled:opacity-50"
                  aria-label={recording ? 'Stop recording' : 'Capture video'}
                >
                  <Circle
                    size={51}
                    fill={recording ? '#FF6600' : '#EF4444'}
                    stroke={recording ? '#FF6600' : '#EF4444'}
                    className={recording ? 'animate-pulse' : ''}
                  />
                </button>
                <span className="mt-1 text-[10px] font-bold text-white/85">
                  {recording ? 'Stop' : 'Capture'}
                </span>
              </div>
            </>
          )}
          <div className="flex items-center gap-3">
            {[1, -1].map((direction) => (
              <button
                key={direction}
                type="button"
                onClick={() => changeFilter(direction)}
                className="flex flex-col items-center gap-1 text-white"
                aria-label={`${direction === 1 ? 'Next' : 'Previous'} filter. Current filter: ${activeFilter.name}`}
                title={activeFilter.name}
              >
                <span className="grid size-12 place-items-center rounded-full border-2 border-[#FF6600]/70 bg-black/25 backdrop-blur-sm">
                  <span
                    className="size-8 rounded-full border border-white/80 bg-gradient-to-br from-amber-300 via-orange-500 to-rose-700"
                    style={{ filter: activeFilter.css }}
                  />
                </span>
                <span className="max-w-14 truncate text-[9px] font-semibold">
                  {activeFilter.shortName}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {file && !showDetails && (
        <button
          type="button"
          onClick={openDetails}
          className="absolute bottom-28 left-1/2 z-30 -translate-x-1/2 rounded-full bg-[#FF6600] px-8 py-3 font-extrabold text-white shadow-xl"
        >
          Next
        </button>
      )}

      {cameraError && !file && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="absolute bottom-28 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#FF6600] px-6 py-3 text-sm font-bold"
        >
          Choose a video
        </button>
      )}

      {showDetails && (
        <div className="absolute inset-0 z-40 flex items-end bg-black/50 backdrop-blur-sm">
          <section className="max-h-[88dvh] w-full overflow-y-auto rounded-t-3xl border-t border-white/15 bg-neutral-950/95 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5">
            <div className="mb-5 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowDetails(false)}
                className="grid size-9 place-items-center rounded-full bg-white/10"
                aria-label="Back to video"
              >
                <ArrowLeft size={20} />
              </button>
              <h2 className="text-lg font-extrabold">Dish details</h2>
              <button
                type="button"
                onClick={onClose}
                className="grid size-9 place-items-center rounded-full bg-white/10"
                aria-label="Close upload"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={postBite} className="space-y-4">
              <label className="block text-sm font-semibold text-white/80">
                Select Restaurant
                <select
                  required
                  value={selectedRestaurantId}
                  disabled={loadingRestaurants}
                  onChange={(event) => selectRestaurant(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-white/15 bg-neutral-900 px-3.5 py-3 text-sm text-white outline-none focus:border-[#FF6600]"
                >
                  <option value="">
                    {loadingRestaurants ? 'Loading restaurants…' : 'Select Restaurant'}
                  </option>
                  {restaurants.map((restaurant) => (
                    <option key={restaurant.id} value={restaurant.id}>
                      {restaurant.name}
                    </option>
                  ))}
                </select>
              </label>
              {selectedRestaurantId && (
                <div>
                  <p className="mb-2 text-sm font-semibold text-white/80">Choose a dish</p>
                  {loadingMenu ? (
                    <p className="text-sm text-white/55">Loading menu…</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {menuItems.map((food) => (
                        <button
                          key={food.id}
                          type="button"
                          onClick={() => {
                            setSelectedFoodItemId(food.id)
                            setIsAddingDish(false)
                          }}
                          className={`rounded-full border px-3 py-2 text-xs font-semibold ${
                            selectedFoodItemId === food.id && !isAddingDish
                              ? 'border-[#FF6600] bg-[#FF6600]/20 text-white'
                              : 'border-white/20 bg-white/5 text-white/75'
                          }`}
                        >
                          {food.name} — ₹{food.price}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingDish(true)
                          setSelectedFoodItemId('')
                        }}
                        className={`flex items-center gap-1 rounded-full border px-3 py-2 text-xs font-bold ${
                          isAddingDish
                            ? 'border-[#FF6600] bg-[#FF6600]/20 text-white'
                            : 'border-white/20 bg-white/5 text-white/75'
                        }`}
                      >
                        <Plus size={14} />
                        Add New Dish
                      </button>
                    </div>
                  )}
                </div>
              )}
              {isAddingDish && (
                <>
                  <label className="block text-sm font-semibold text-white/80">
                    New Dish Name
                    <input
                      required
                      value={newDishName}
                      onChange={(event) => setNewDishName(event.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-3 text-sm text-white outline-none focus:border-[#FF6600]"
                      placeholder="Dish name"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-white/80">
                    Price (₹)
                    <input
                      required
                      type="number"
                      min="0"
                      step="1"
                      inputMode="decimal"
                      value={newPrice}
                      onChange={(event) => setNewPrice(event.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-3 text-sm text-white outline-none focus:border-[#FF6600]"
                      placeholder="Price"
                    />
                  </label>
                </>
              )}
              {selectedFoodItemId && !isAddingDish && (
                <p className="text-sm font-semibold text-orange-300">
                  {selectedFood?.name} — ₹{selectedFood?.price}
                </p>
              )}
              <label className="block text-sm font-semibold text-white/80">
                Caption / Hashtags
                <textarea
                  rows={3}
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  className="mt-1.5 w-full resize-none rounded-xl border border-white/15 bg-white/5 px-3.5 py-3 text-sm text-white outline-none focus:border-[#FF6600]"
                  placeholder="Tell everyone about this Bite #food"
                />
              </label>

              {error && (
                <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {error}
                </p>
              )}
              {uploading && (
                <div>
                  <div className="mb-1 flex justify-between text-xs text-white/70">
                    <span>Uploading your Bite…</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/15">
                    <div className="h-full bg-[#FF6600] transition-[width]" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={
                  uploading ||
                  loadingRestaurants ||
                  loadingMenu ||
                  !selectedRestaurantId ||
                  (!selectedFoodItemId && !isAddingDish)
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF6600] py-3.5 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={18} />
                {uploading ? 'Posting…' : 'Post Bite'}
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}

export default UploadScreen
