import { Home, Building2, Layers, DoorOpen } from 'lucide-react';

// The four ways a property can be organised. `key` matches the server's
// PropertyStructure enum.
export const PROPERTY_STRUCTURES = [
  {
    key: 'whole',
    label: 'Whole property',
    short: 'Whole property',
    icon: Home,
    description: 'One house, villa, shop or plot rented as a single unit. You set its price, bedrooms, bathrooms and facilities right now.',
    next: 'Add its price and details',
  },
  {
    key: 'buildings',
    label: 'Property with buildings',
    short: 'Buildings',
    icon: Building2,
    description: 'Several buildings (for example houses in a compound), each rented as a whole. After saving you add each building with its own price, bedrooms, bathrooms and facilities.',
    next: 'Add buildings after saving',
  },
  {
    key: 'buildings_units',
    label: 'Buildings with units',
    short: 'Buildings & units',
    icon: Layers,
    description: 'Buildings that contain rentable units such as flats, rooms or shops. After saving you add the buildings, then the units inside each one.',
    next: 'Add buildings and their units after saving',
  },
  {
    key: 'units',
    label: 'Property with units',
    short: 'Units',
    icon: DoorOpen,
    description: 'Units (rooms, flats or shops) placed directly in the property, with no separate buildings. After saving you add the units with their prices and details.',
    next: 'Add units after saving',
  },
];

export const structureOf = (key) => PROPERTY_STRUCTURES.find((s) => s.key === key) ?? PROPERTY_STRUCTURES[2];

// Common facilities offered as one-tap choices (anything else can be typed in).
export const COMMON_AMENITIES = [
  'Parking', 'Generator', 'Solar power', 'Water supply', 'Borehole', 'Security guard', 'CCTV', 'Fenced compound',
  'Air conditioning', 'Balcony', 'Garden', 'Swimming pool', 'Gym', 'Elevator', 'Internet / Wi-Fi', 'Laundry',
  'Kitchen', 'Wardrobes', 'Tiled floors', 'Pet friendly',
];
