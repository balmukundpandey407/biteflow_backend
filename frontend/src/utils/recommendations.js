function normalize(value) {
  return String(value ?? '').trim().toLowerCase()
}

function isKnownVegetarian(food) {
  return ['true', '1', 'yes', 'veg', 'vegetarian'].includes(
    normalize(food?.is_veg),
  )
}

function isKnownNonVegetarian(food) {
  return ['false', '0', 'no', 'non-veg', 'nonveg'].includes(
    normalize(food?.is_veg),
  )
}

function getFood(entry) {
  return entry?.food ?? entry?.food_item ?? entry
}

function getPopularity(entry) {
  const video = entry?.reel ?? entry
  return (
    Number(video?.total_likes ?? video?.likes ?? 0) * 3 +
    Number(video?.total_views ?? video?.views ?? 0) +
    Number(video?.total_comments ?? video?.comments ?? 0) * 2
  )
}

function getPersonalizationScore(entry, { searchHistory, orderHistory }) {
  const food = getFood(entry)
  const text = `${food?.name ?? ''} ${food?.restaurants?.name ?? ''}`.toLowerCase()
  const searches = searchHistory.filter((query) => {
    const normalized = normalize(query)
    return normalized && text.includes(normalized)
  }).length
  const ordered = orderHistory.some((order) => {
    const orderFoodId = order.food_item_id ?? order.food_item?.id
    const orderName = normalize(order.food_item?.name ?? order.food_name)
    return (
      (food?.id && orderFoodId && String(food.id) === String(orderFoodId)) ||
      (orderName && normalize(food?.name) === orderName)
    )
  })

  return searches * 2 + (ordered ? 4 : 0)
}

function getPreferenceScore(entry, preference) {
  if (preference !== 'veg' && preference !== 'non-veg') return 0
  const food = getFood(entry)
  const matches =
    preference === 'veg'
      ? isKnownVegetarian(food)
      : isKnownNonVegetarian(food)
  const knownOther =
    preference === 'veg'
      ? isKnownNonVegetarian(food)
      : isKnownVegetarian(food)
  return matches ? 5 : knownOther ? -5 : 0
}

function rankRecommendations(entries, options = {}) {
  const {
    foodPreference = '',
    searchHistory = [],
    orderHistory = [],
  } = options

  return entries
    .map((entry, index) => ({
      entry,
      index,
      score:
        getPopularity(entry) +
        getPreferenceScore(entry, foodPreference) +
        getPersonalizationScore(entry, { searchHistory, orderHistory }),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ entry }) => entry)
}

export function rankDishes(dishes, options) {
  return rankRecommendations(dishes, options)
}

export function rankBites(bites, options) {
  return rankRecommendations(bites, options)
}
