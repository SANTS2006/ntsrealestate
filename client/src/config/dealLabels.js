// Shared wording for deals (renting, buying and leasing).
export const DEAL_KINDS = {
  rent: { label: 'Rent', tone: 'brand', noun: 'rental' },
  buy: { label: 'Purchase', tone: 'success', noun: 'purchase' },
  lease: { label: 'Lease', tone: 'warning', noun: 'lease' },
};

export const DEAL_STATUS = {
  pending: { label: 'Pending', tone: 'warning' },
  approved: { label: 'Approved', tone: 'brand' },
  completed: { label: 'Completed', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

export const LAND_STATUS = {
  available: { label: 'Available', tone: 'success' },
  reserved: { label: 'Reserved', tone: 'warning' },
  sold: { label: 'Sold', tone: 'neutral' },
  unavailable: { label: 'Unavailable', tone: 'neutral' },
};

export const LAND_TYPES = [
  { value: 'residential', label: 'Residential' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'agricultural', label: 'Agricultural' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'mixed_use', label: 'Mixed use' },
  { value: 'other', label: 'Other' },
];

export const AREA_UNITS = [
  { value: 'acres', label: 'Acres' },
  { value: 'hectares', label: 'Hectares' },
  { value: 'sqm', label: 'Square metres' },
  { value: 'plots', label: 'Plots' },
];

export const LAND_FEATURES = [
  'Road access', 'Electricity nearby', 'Water supply', 'Fenced', 'Flat ground', 'Near the main road', 'Near a school',
  'Near a market', 'Good drainage', 'Titled / registered', 'Surveyed', 'Ready to build', 'Fertile soil', 'River access',
];

export const labelFor = (list, value) => list.find((x) => x.value === value)?.label ?? value;

export const FREQUENCY = {
  monthly: { label: 'Monthly', every: 'every month', unit: 'month' },
  yearly: { label: 'Yearly', every: 'every year', unit: 'year' },
};

export const INSTALLMENT_STATUS = {
  pending: { label: 'Upcoming', tone: 'neutral' },
  partial: { label: 'Part paid', tone: 'warning' },
  paid: { label: 'Paid', tone: 'success' },
  overdue: { label: 'Overdue', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

export const END_REASONS = [
  { value: 'moved_out', label: 'Moved out' },
  { value: 'expired', label: 'Term finished, not renewing' },
  { value: 'cancelled', label: 'Cancelled' },
];
