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
  Search,
  Timer,
  X,
  MapPin,
} from 'lucide-react'

const API_ORIGIN = 'https://crispy-waffle-7vjrgrx67pww2w55w-8000.app.github.dev'
const RESTAURANTS_URL = `${API_ORIGIN}/restaurants`
const CLOUDINARY_CLOUD_NAME =
  import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'j37518cz'
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`
const CLOUDINARY_UPLOAD_PRESET = 'biteflows_bites'
const VIDEO_FILTERS = [
  { name: 'Normal', shortName: 'Normal', css: 'none' },
  { name: 'Warm', shortName: 'Warm', css: 'saturate(1.2) sepia(0.12) hue-rotate(-8deg)' },
  { name: 'Crispy', shortName: 'Crispy', css: 'contrast(1.2) saturate(1.15)' },
  { name: 'Fresh', shortName: 'Fresh', css: 'saturate(1.4) brightness(1.04)' },
  { name: 'Vintage', shortName: 'Vintage', css: 'sepia(0.35) saturate(0.85) contrast(1.08)' },
]

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
  const filterTouchStartXRef = useRef(null)
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
  const [wizardStep, setWizardStep] = useState('restaurant')
  const [restaurants, setRestaurants] = useState([])
  const [restaurantSearch, setRestaurantSearch] = useState('')
  const [dishSearch, setDishSearch] = useState('')
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('')
  const [menuItems, setMenuItems] = useState([])
  const [selectedFoodItemId, setSelectedFoodItemId] = useState('')
  const [isAddingDish, setIsAddingDish] = useState(false)
  const [newDishName, setNewDishName] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [title, setTitle] = useState('')
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
  const selectedRestaurant = restaurants.find(
    (restaurant) => restaurant.id === selectedRestaurantId,
  )
  const filteredRestaurants = restaurants.filter((restaurant) =>
    `${restaurant.name ?? ''} ${restaurant.area ?? ''} ${restaurant.address ?? ''} ${restaurant.description ?? ''}`
      .toLowerCase()
      .includes(restaurantSearch.trim().toLowerCase()),
  )
  const filteredMenuItems = menuItems.filter((food) =>
    `${food.name ?? ''} ${food.description ?? ''}`
      .toLowerCase()
      .includes(dishSearch.trim().toLowerCase()),
  )

  const setVideoFile = (videoFile) => {
    if (!videoFile) return
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(videoFile)
    setPreviewUrl(URL.createObjectURL(videoFile))
    setShowDetails(false)
    setWizardStep('restaurant')
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
    setWizardStep('restaurant')
    setError('')
    if (restaurants.length || loadingRestaurants) return
    setLoadingRestaurants(true)
    setError('')
    try {
      const response = await fetch(RESTAURANTS_URL)
      const data = await response.json()
      if (!response.ok) throw new Error('Restaurant list is temporarily unavailable.')
      const availableRestaurants = Array.isArray(data)
        ? data
        : data.data || data.items || data.restaurants || []
      setRestaurants(availableRestaurants)
      if (!availableRestaurants.length) setError('No restaurants are available right now.')
    } catch (restaurantError) {
      console.error('Unable to load restaurants', restaurantError)
      setError('Could not load restaurants. Check your connection and try again.')
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
      if (!response.ok) throw new Error('This restaurant menu is temporarily unavailable.')
      const menu = Array.isArray(data) ? data : data.data || data.items || data.menu || []
      if (requestId !== menuRequestRef.current) return
      setMenuItems(menu)
      setDishSearch('')
      setWizardStep('dish')
    } catch (menuError) {
      if (requestId !== menuRequestRef.current) return
      console.error('Unable to load restaurant menu', menuError)
      setError('Could not load this menu. Please try selecting the restaurant again.')
    } finally {
      if (requestId === menuRequestRef.current) setLoadingMenu(false)
    }
  }

  const uploadToCloudinary = (videoFile) =>
    new Promise((resolve, reject) => {
      const formData = new FormData()
      formData.append('file', videoFile)
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)

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

  const continueToDetails = () => {
    if (!isAddingDish && !selectedFoodItemId) {
      setError('Choose a dish before continuing.')
      return
    }
    if (isAddingDish && (!newDishName.trim() || newPrice === '' || Number(newPrice) < 0)) {
      setError('Enter a dish name and valid price before continuing.')
      return
    }
    setTitle((current) =>
      current.trim() || (isAddingDish ? newDishName.trim() : selectedFood?.name || ''),
    )
    setError('')
    setWizardStep('details')
  }

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
    if (!title.trim()) {
      setError('Add a title for your Bite before publishing.')
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
      const response = await fetch(`${API_ORIGIN}/video`, {
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
          title: title.trim(),
          description: caption.trim(),
          video_url: videoUrl,
          thumbnail_url: thumbnailUrl,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(
          response.status === 401
            ? 'Your session expired. Sign in again before publishing.'
            : response.status === 404
              ? 'The selected restaurant or dish is no longer available.'
              : response.status === 422
                ? 'Some Bite details are missing or invalid. Review them and try again.'
                : 'Unable to publish right now. Please check your connection and try again.',
        )
      }
      if (!data.id || !data.food_item?.id) {
        throw new Error(
          'Unable to publish right now. Please check your connection and try again.',
        )
      }
      setProgress(100)
      onPosted({
        id: data.id,
        food_item_id: data.food_item.id,
        title: title.trim(),
        description: caption.trim(),
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl,
        total_views: 0,
        total_likes: 0,
        total_comments: 0,
        food_item: data.food_item,
      })
    } catch (uploadError) {
      console.error('Unable to publish Bite', uploadError)
      setError(
        uploadError instanceof TypeError
          ? 'Unable to publish right now. Please check your connection and try again.'
          : uploadError.message || 'Unable to publish right now. Please try again.',
      )
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
          style={{ filter: activeFilter.css }}
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
          className="absolute inset-x-0 bottom-7 z-20 h-40"
        >
          {!file && (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={recording}
                className="absolute bottom-4 left-7 grid size-12 place-items-center rounded-full bg-[#FF6600]/25 text-white disabled:opacity-40"
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
              <div className="absolute bottom-0 left-1/2 flex -translate-x-1/2 flex-col items-center">
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
          <div
            className="absolute inset-x-2 top-0 flex h-14 items-start justify-center gap-1 touch-none"
            onTouchStart={(event) => {
              filterTouchStartXRef.current = event.touches[0]?.clientX ?? null
            }}
            onTouchEnd={(event) => {
              const startX = filterTouchStartXRef.current
              const endX = event.changedTouches[0]?.clientX
              filterTouchStartXRef.current = null
              if (startX === null || endX === undefined || Math.abs(endX - startX) < 20) return
              event.preventDefault()
              changeFilter(endX < startX ? 1 : -1)
            }}
            aria-label="Camera filters"
          >
            {VIDEO_FILTERS.map((filter, index) => {
              const active = index === filterIndex
              return (
              <button
                key={filter.name}
                type="button"
                onClick={() => setFilterIndex(index)}
                className={`flex w-14 shrink-0 flex-col items-center gap-0.5 rounded-xl border px-1 py-1 text-white backdrop-blur-md transition-all duration-200 ${
                  active
                    ? 'border-[#FF6600] bg-black/65'
                    : 'border-white/20 bg-black/35 opacity-80'
                }`}
                aria-label={`Preview ${filter.name} filter`}
                aria-pressed={active}
                title={filter.name}
              >
                <span className={`grid place-items-center rounded-full border-2 bg-black/35 ${
                  active ? 'size-9 border-[#FF6600]' : 'size-8 border-white/70'
                }`}>
                  <span
                    className="size-6 rounded-full border border-white/80 bg-gradient-to-br from-amber-300 via-orange-500 to-rose-700"
                    style={{ filter: filter.css }}
                  />
                </span>
                <span className="max-w-full truncate text-[8px] font-bold leading-tight">
                  {filter.shortName}
                </span>
              </button>
              )
            })}
          </div>
        </div>
      )}

      {file && !showDetails && (
        <button
          type="button"
          onClick={openDetails}
          className="absolute bottom-8 left-1/2 z-30 -translate-x-1/2 rounded-full bg-[#FF6600] px-8 py-3 font-extrabold text-white shadow-xl"
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
        <div className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-neutral-950/98 text-white">
          <div className="flex items-center gap-3 border-b border-white/10 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
            <button
              type="button"
              onClick={() => {
                if (wizardStep === 'restaurant') setShowDetails(false)
                else if (wizardStep === 'dish') setWizardStep('restaurant')
                else setWizardStep('dish')
                setError('')
              }}
              className="grid size-10 shrink-0 place-items-center rounded-full border border-white/15 bg-white/5"
              aria-label={wizardStep === 'restaurant' ? 'Back to camera' : 'Previous step'}
              disabled={uploading}
            >
              <ArrowLeft size={20} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-300">
                Step {wizardStep === 'restaurant' ? 1 : wizardStep === 'dish' ? 2 : 3} of 3
              </p>
              <h2 className="truncate text-lg font-extrabold">
                {wizardStep === 'restaurant'
                  ? 'Select Restaurant'
                  : wizardStep === 'dish'
                    ? 'Select Dish'
                    : 'Bite details & publish'}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid size-10 shrink-0 place-items-center rounded-full border border-white/15 bg-white/5"
              aria-label="Close upload"
              disabled={uploading}
            >
              <X size={20} />
            </button>
          </div>

          <div className="h-1 w-full bg-white/10">
            <div
              className="h-full bg-[#FF6600] transition-all duration-300"
              style={{
                width: `${wizardStep === 'restaurant' ? 33 : wizardStep === 'dish' ? 66 : 100}%`,
              }}
            />
          </div>

          {wizardStep === 'restaurant' && (
            <section className="flex min-h-0 flex-1 flex-col px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5">
              <p className="mb-4 text-sm text-white/60">
                Search by restaurant name or campus area.
              </p>
              <label className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-3">
                <Search size={18} className="text-orange-300" />
                <input
                  autoFocus
                  value={restaurantSearch}
                  onChange={(event) => setRestaurantSearch(event.target.value)}
                  placeholder="Search restaurants or areas"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/40"
                  aria-label="Search restaurants"
                />
                {loadingRestaurants && (
                  <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-orange-400" />
                )}
              </label>
              {error && (
                <p role="alert" className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {error}
                </p>
              )}
              <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pb-2">
                {filteredRestaurants.map((restaurant) => (
                  <button
                    key={restaurant.id}
                    type="button"
                    disabled={loadingMenu}
                    onClick={() => selectRestaurant(restaurant.id)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-orange-400/50 hover:bg-white/10 disabled:opacity-50"
                  >
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-orange-500/15 text-orange-300">
                      <MapPin size={20} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{restaurant.name}</span>
                      <span className="mt-1 block line-clamp-2 text-xs text-white/55">
                        {restaurant.area || restaurant.address || restaurant.description || 'Campus restaurant'}
                      </span>
                    </span>
                    {loadingMenu && selectedRestaurantId === restaurant.id ? (
                      <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-orange-400" />
                    ) : (
                      <span className="text-xs font-bold text-orange-300">Select</span>
                    )}
                  </button>
                ))}
                {!loadingRestaurants && !filteredRestaurants.length && (
                  <p className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center text-sm text-white/55">
                    {restaurants.length
                      ? 'No restaurants match your search.'
                      : 'No restaurants are available right now.'}
                  </p>
                )}
              </div>
            </section>
          )}

          {wizardStep === 'dish' && (
            <section className="flex min-h-0 flex-1 flex-col px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5">
              <p className="mb-3 truncate text-sm font-semibold text-orange-200">
                {selectedRestaurant?.name}
              </p>
              <label className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-3">
                <Search size={18} className="text-orange-300" />
                <input
                  value={dishSearch}
                  onChange={(event) => setDishSearch(event.target.value)}
                  placeholder="Search this menu"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/40"
                  aria-label="Search menu"
                />
              </label>
              <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pb-3">
                {filteredMenuItems.map((food) => {
                  const selected = selectedFoodItemId === food.id && !isAddingDish
                  const isVeg = ['true', '1', 'yes', 'veg', 'vegetarian'].includes(
                    String(food.is_veg).toLowerCase(),
                  )
                  return (
                    <button
                      key={food.id}
                      type="button"
                      onClick={() => {
                        setSelectedFoodItemId(food.id)
                        setIsAddingDish(false)
                        setTitle(food.name || '')
                        setError('')
                      }}
                      className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
                        selected
                          ? 'border-[#FF6600] bg-[#FF6600]/10'
                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                      }`}
                      aria-pressed={selected}
                    >
                      <img
                        src={food.image_url || undefined}
                        alt=""
                        className="size-16 shrink-0 rounded-xl bg-white/10 object-cover"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{food.name}</span>
                        <span className="mt-1 block text-sm font-extrabold text-orange-300">
                          ₹{food.price}
                        </span>
                        <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isVeg ? 'bg-emerald-500/20 text-emerald-200' : 'bg-red-500/20 text-red-200'
                        }`}>
                          {isVeg ? 'VEG' : 'NON-VEG'}
                        </span>
                      </span>
                      {selected && <span className="text-xs font-bold text-orange-300">Selected</span>}
                    </button>
                  )
                })}
                {!loadingMenu && !filteredMenuItems.length && !isAddingDish && (
                  <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center text-sm text-white/55">
                    No dishes match your search. You can add a new dish below.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingDish(true)
                    setSelectedFoodItemId('')
                    setTitle(newDishName.trim())
                  }}
                  className={`flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed py-4 text-sm font-bold ${
                    isAddingDish
                      ? 'border-[#FF6600] bg-[#FF6600]/10 text-orange-200'
                      : 'border-white/20 text-white/75'
                  }`}
                >
                  <Plus size={17} />
                  Add New Dish
                </button>
                {isAddingDish && (
                  <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <label className="block text-xs font-semibold text-white/75">
                      New dish name
                      <input
                        value={newDishName}
                        onChange={(event) => {
                          setNewDishName(event.target.value)
                          setTitle(event.target.value)
                        }}
                        placeholder="Dish name"
                        className="mt-1.5 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-orange-400"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-white/75">
                      Price (₹)
                      <input
                        type="number"
                        min="0"
                        step="1"
                        inputMode="decimal"
                        value={newPrice}
                        onChange={(event) => setNewPrice(event.target.value)}
                        placeholder="Price"
                        className="mt-1.5 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-orange-400"
                      />
                    </label>
                  </div>
                )}
              </div>
              {error && (
                <p role="alert" className="mb-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {error}
                </p>
              )}
              <button
                type="button"
                onClick={continueToDetails}
                disabled={loadingMenu || (!selectedFoodItemId && !isAddingDish)}
                className="w-full rounded-xl bg-[#FF6600] py-3.5 text-sm font-extrabold disabled:opacity-50"
              >
                Continue to details
              </button>
            </section>
          )}

          {wizardStep === 'details' && (
            <section className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
              <form onSubmit={postBite} className="space-y-4">
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                  <video
                    src={previewUrl || undefined}
                    className="h-48 w-full bg-black object-cover"
                    poster={previewUrl ? undefined : ''}
                    controls
                    playsInline
                    muted
                  />
                  <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <span className="truncate text-xs font-semibold text-white/70">
                      {selectedRestaurant?.name} · {isAddingDish ? newDishName : selectedFood?.name}
                    </span>
                    <span className="shrink-0 rounded-full bg-orange-500/15 px-2.5 py-1 text-[10px] font-bold text-orange-200">
                      {file?.name || 'Video preview'}
                    </span>
                  </div>
                </div>
                <label className="block text-xs font-semibold text-white/75">
                  Title
                  <input
                    required
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={120}
                    placeholder="Give your Bite a title"
                    className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#FF6600]"
                  />
                </label>
                <label className="block text-xs font-semibold text-white/75">
                  Caption / Description & Hashtags
                  <textarea
                    rows={4}
                    value={caption}
                    onChange={(event) => setCaption(event.target.value)}
                    maxLength={1000}
                    placeholder="Tell everyone about this Bite #food"
                    className="mt-1.5 w-full resize-none rounded-xl border border-white/15 bg-white/5 px-3.5 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#FF6600]"
                  />
                </label>
                {error && (
                  <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-200">
                    {error}
                  </p>
                )}
                {uploading && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="mb-2 flex justify-between text-xs text-white/70">
                      <span>Publishing your Bite…</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/15">
                      <div
                        className="h-full bg-[#FF6600] transition-[width]"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={uploading || !title.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF6600] py-3.5 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus size={18} />
                  {uploading ? 'Publishing…' : 'Post Bite'}
                </button>
              </form>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

export default UploadScreen
