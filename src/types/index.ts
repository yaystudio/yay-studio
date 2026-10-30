export interface Service {
  id: string;
  name: string;
  slug: string;
  subtitle: string;
  description: string;
  price: number;
  originalPrice: number;
  durationMinutes: number;
  openTime: string; // e.g. "10:00"
  closeTime: string; // e.g. "21:30"
  sessionDurationText: string;
  selectionDurationText: string;
  maxPeople: number;
  extraPersonPrice: number; // e.g. 30000
  includedPrints: string;
  softFiles: string;
  perks: string[];
  recommendedFor?: string;
  badge?: string;
  image: string; // URL or Data URL
  personPricing?: Record<number, number>; // maps count of people to price, e.g. { 1: 100000, 2: 120000, 3: 150000 }
}

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export interface Booking {
  id: string;
  serviceId: string;
  serviceName: string;
  date: string; // YYYY-MM-DD
  timeSlot: string; // e.g. "18:30"
  backdrop: string;
  peopleCount: number;
  addons?: {
    id: string;
    name: string;
    price: number;
    count: number;
  }[];
  customer: {
    name: string;
    email: string;
    whatsapp: string;
    notes?: string;
  };
  totalPrice: number;
  paymentNote: string; // "Pembayaran dapat dilakukan saat di studio"
  status: BookingStatus;
  createdAt: string;
}

export interface BlockedSlot {
  date: string; // YYYY-MM-DD
  timeSlot: string;
}

export interface StudioConfig {
  name: string;
  tagline: string;
  adminEmail: string;
  whatsappNumber: string;
  address: string;
  operatingHours: string;
  instagram: string;
  paymentNote: string;
}
