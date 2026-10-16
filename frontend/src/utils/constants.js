// constants.js - Labels for the values the backend uses (must match backend/app/utils/constants.py).

export const FOOD_CATEGORIES = {
  cooked_meals: 'Cooked meals',
  bakery: 'Bakery',
  fruits_vegetables: 'Fruits & vegetables',
  dairy: 'Dairy',
  packaged_food: 'Packaged food',
  beverages: 'Beverages',
  other: 'Other',
}

export const DIETARY_TYPES = {
  vegetarian: 'Vegetarian',
  non_vegetarian: 'Non-vegetarian',
  vegan: 'Vegan',
}

export const STORAGE_TYPES = {
  room_temperature: 'Room temperature',
  refrigerated: 'Refrigerated',
  frozen: 'Frozen',
}

export const QUANTITY_UNITS = ['kg', 'litres', 'portions', 'packets', 'trays', 'boxes']

export const DONOR_TYPES = {
  restaurant: 'Restaurant',
  hotel: 'Hotel',
  canteen: 'College / office canteen',
  bakery: 'Bakery',
  supermarket: 'Supermarket',
  caterer: 'Caterer',
  individual: 'Individual',
  other: 'Other',
}

export const NGO_DIETARY_PREFERENCES = {
  any: 'Accepts all food',
  prefers_vegetarian: 'Prefers vegetarian',
  vegetarian_only: 'Vegetarian only',
  vegan_only: 'Vegan only',
}

// Every donation status with a friendly label, a short meaning and badge colours.
export const STATUS_INFO = {
  AVAILABLE: { label: 'Available', meaning: 'Published and waiting for an NGO', color: 'bg-brand-100 text-brand-800' },
  REQUESTED: { label: 'Requested', meaning: 'An NGO request or donor offer is waiting for a decision', color: 'bg-amber-100 text-amber-800' },
  ACCEPTED: { label: 'Accepted', meaning: 'An NGO has been confirmed to collect it', color: 'bg-sky-100 text-sky-800' },
  PICKUP_SCHEDULED: { label: 'Pickup scheduled', meaning: 'The NGO has planned a pickup time', color: 'bg-indigo-100 text-indigo-800' },
  COLLECTED: { label: 'Collected', meaning: 'The NGO has picked up the food', color: 'bg-violet-100 text-violet-800' },
  DELIVERED: { label: 'Delivered', meaning: 'Food was distributed to people in need', color: 'bg-emerald-600 text-white' },
  CANCELLED: { label: 'Cancelled', meaning: 'Cancelled by the donor', color: 'bg-gray-200 text-gray-700' },
  EXPIRED: { label: 'Expired', meaning: 'Time ran out before collection', color: 'bg-orange-100 text-orange-800' },
  REJECTED: { label: 'Rejected', meaning: 'Removed by an administrator', color: 'bg-red-100 text-red-800' },
}

export const NORMAL_FLOW = ['AVAILABLE', 'REQUESTED', 'ACCEPTED', 'PICKUP_SCHEDULED', 'COLLECTED', 'DELIVERED']

export const REQUEST_STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-800',
  accepted: 'bg-brand-100 text-brand-800',
  rejected: 'bg-red-100 text-red-700',
  withdrawn: 'bg-gray-200 text-gray-700',
}

export const label = (map, key) => map[key] || (key ? String(key).replace(/_/g, ' ') : '-')
