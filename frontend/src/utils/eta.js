const FALLBACK_ETA_MINUTES = 35

function getCoordinates(value) {
  const latitude = Number(value?.latitude ?? value?.lat)
  const longitude = Number(value?.longitude ?? value?.lon ?? value?.lng)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null
  return { latitude, longitude }
}

function getSavedCoordinates() {
  try {
    const stored = JSON.parse(localStorage.getItem('biteflow_coordinates') || 'null')
    return getCoordinates(stored)
  } catch {
    return null
  }
}

function haversineDistanceKm(first, second) {
  const radians = (degrees) => (degrees * Math.PI) / 180
  const latitudeDelta = radians(second.latitude - first.latitude)
  const longitudeDelta = radians(second.longitude - first.longitude)
  const haversine = Math.min(1, Math.max(0,
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(first.latitude)) *
      Math.cos(radians(second.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2,
  ))
  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

export function getDeliveryEtaMinutes(restaurant, userCoordinates = getSavedCoordinates()) {
  const destination = getCoordinates(restaurant)
  const origin = getCoordinates(userCoordinates)
  if (!destination || !origin) return FALLBACK_ETA_MINUTES

  const distanceKm = haversineDistanceKm(origin, destination)
  return Math.min(60, Math.max(15, Math.ceil(12 + distanceKm * 5)))
}
