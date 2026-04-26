import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, Trash2, ChevronDown, Save, Eye } from 'lucide-react';
import { toast } from 'sonner';

const SUBMIT_WHATSAPP_E164 = '254759550133';

interface Answer {
  id: string;
  text: string;
  isCustom?: boolean;
}

interface Question {
  id: string;
  category: string;
  categoryIcon: string;
  title: string;
  type: 'text' | 'textarea' | 'dropdown' | 'checkbox' | 'multi-select';
  answers?: Answer[];
  value?: string | string[];
  customAnswers?: Answer[];
  isCustomQuestion?: boolean;
}

interface ContactInfo {
  ownerName: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
  instagram: string;
  facebook: string;
  x: string;
  youtube: string;
  tiktok: string;
}

interface SaveState {
  questions: Question[];
  contactInfo: ContactInfo;
  additionalInfo: string;
  expandedCategory: string | null;
  lastSaved: number;
}

function migrateLoadedQuestions(loaded: Question[]): Question[] {
  return loaded.map(q => {
    if (q.type !== 'dropdown') return q;
    if (Array.isArray(q.value)) return q;
    if (typeof q.value === 'string' && q.value.trim() !== '') {
      return { ...q, value: [q.value] };
    }
    return { ...q, value: [] };
  });
}

function getDropdownSelections(q: Question): string[] {
  if (!q.value) return [];
  if (Array.isArray(q.value)) return q.value;
  if (typeof q.value === 'string' && q.value.trim() !== '') return [q.value];
  return [];
}

const STORAGE_KEY = 'bnb_questionnaire_data';
const AUTO_SAVE_INTERVAL = 5000;

const defaultQuestions: Question[] = [
  // Property Information
  {
    id: 'q1',
    category: 'Property Information',
    categoryIcon: '🏡',
    title: 'What is the name of your BnB?',
    type: 'text',
  },
  {
    id: 'q2',
    category: 'Property Information',
    categoryIcon: '🏡',
    title: 'What is the exact address of your BnB (including postal code)?',
    type: 'textarea',
  },
  {
    id: 'q3',
    category: 'Property Information',
    categoryIcon: '🏡',
    title: 'What type of BnB are you operating?',
    type: 'dropdown',
    answers: [
      { id: 'a1', text: 'Family-friendly' },
      { id: 'a2', text: 'Luxury' },
      { id: 'a3', text: 'Boutique' },
      { id: 'a4', text: 'Budget' },
      { id: 'a5', text: 'Eco-friendly' },
      { id: 'a6', text: 'Romantic getaway' },
    ],
  },
  {
    id: 'q4',
    category: 'Property Information',
    categoryIcon: '🏡',
    title: 'What makes your BnB unique compared to others?',
    type: 'textarea',
  },
  {
    id: 'q5',
    category: 'Property Information',
    categoryIcon: '🏡',
    title: 'What is the maximum capacity (total number of guests) the BnB can accommodate?',
    type: 'text',
  },

  // Room Details
  {
    id: 'q6',
    category: 'Room Details',
    categoryIcon: '🛏️',
    title: 'How many rooms do you have?',
    type: 'text',
  },
  {
    id: 'q7',
    category: 'Room Details',
    categoryIcon: '🛏️',
    title: 'Please specify the types of rooms available',
    type: 'textarea',
  },
  {
    id: 'q8',
    category: 'Room Details',
    categoryIcon: '🛏️',
    title: 'What are the details for each room? (name, size, beds, features)',
    type: 'textarea',
  },
  {
    id: 'q9',
    category: 'Room Details',
    categoryIcon: '🛏️',
    title: 'Do you have room availability based on seasons?',
    type: 'dropdown',
    answers: [
      { id: 'a7', text: 'Yes, peak/off-peak pricing' },
      { id: 'a8', text: 'Yes, seasonal variations' },
      { id: 'a9', text: 'No, consistent pricing' },
    ],
  },
  {
    id: 'q10',
    category: 'Room Details',
    categoryIcon: '🛏️',
    title: 'Would you like to offer flexible pricing for different room types or seasons?',
    type: 'dropdown',
    answers: [
      { id: 'a10', text: 'Yes' },
      { id: 'a11', text: 'No' },
      { id: 'a12', text: 'Maybe later' },
    ],
  },

  // Amenities & Services
  {
    id: 'q11',
    category: 'Amenities & Services',
    categoryIcon: '🛎️',
    title: 'What amenities are offered at the BnB?',
    type: 'checkbox',
    answers: [
      { id: 'a13', text: 'Wi-Fi' },
      { id: 'a14', text: 'Parking' },
      { id: 'a15', text: 'Breakfast' },
      { id: 'a16', text: 'Swimming pool' },
      { id: 'a17', text: 'Gym' },
      { id: 'a18', text: 'Pet-friendly' },
      { id: 'a19', text: 'Air conditioning' },
      { id: 'a20', text: 'Heating' },
      { id: 'a21', text: 'Kitchen access' },
      { id: 'a22', text: 'Laundry service' },
    ],
  },
  {
    id: 'q12',
    category: 'Amenities & Services',
    categoryIcon: '🛎️',
    title: 'What additional services do you provide?',
    type: 'textarea',
  },
  {
    id: 'q13',
    category: 'Amenities & Services',
    categoryIcon: '🛎️',
    title: 'Do you provide promotional or seasonal packages?',
    type: 'dropdown',
    answers: [
      { id: 'a23', text: 'Yes, extended stay discounts' },
      { id: 'a24', text: 'Yes, seasonal packages' },
      { id: 'a25', text: 'Yes, both' },
      { id: 'a26', text: 'No packages' },
    ],
  },

  // Booking System & Availability
  {
    id: 'q14',
    category: 'Booking System & Availability',
    categoryIcon: '📅',
    title: 'How would you like your booking system to function?',
    type: 'checkbox',
    answers: [
      { id: 'a27', text: 'Online booking through website' },
      { id: 'a28', text: 'Integration with Airbnb' },
      { id: 'a29', text: 'Integration with Booking.com' },
      { id: 'a30', text: 'Manual email inquiries' },
      { id: 'a31', text: 'Integration with multiple platforms' },
    ],
  },
  {
    id: 'q15',
    category: 'Booking System & Availability',
    categoryIcon: '📅',
    title: 'What are your check-in and check-out times?',
    type: 'text',
  },
  {
    id: 'q16',
    category: 'Booking System & Availability',
    categoryIcon: '📅',
    title: 'Would you prefer automatic booking confirmation or manual approval?',
    type: 'dropdown',
    answers: [
      { id: 'a32', text: 'Automatic confirmation' },
      { id: 'a33', text: 'Manual approval' },
      { id: 'a34', text: 'Hybrid approach' },
    ],
  },
  {
    id: 'q17',
    category: 'Booking System & Availability',
    categoryIcon: '📅',
    title: 'Would you like guests to book multiple rooms at once?',
    type: 'dropdown',
    answers: [
      { id: 'a35', text: 'Yes' },
      { id: 'a36', text: 'No' },
      { id: 'a37', text: 'Only for group bookings' },
    ],
  },
  {
    id: 'q18',
    category: 'Booking System & Availability',
    categoryIcon: '📅',
    title: 'Do you want a booking calendar showing real-time availability?',
    type: 'dropdown',
    answers: [
      { id: 'a38', text: 'Yes' },
      { id: 'a39', text: 'No' },
      { id: 'a40', text: 'Not sure' },
    ],
  },

  // Payment Options
  {
    id: 'q19',
    category: 'Payment Options',
    categoryIcon: '💰',
    title: 'What payment methods would you like to accept?',
    type: 'checkbox',
    answers: [
      { id: 'a41', text: 'Credit/Debit cards' },
      { id: 'a42', text: 'PayPal' },
      { id: 'a43', text: 'Stripe' },
      { id: 'a44', text: 'Bank transfer' },
      { id: 'a45', text: 'Mobile payment' },
      { id: 'a46', text: 'Cash on arrival' },
    ],
  },
  {
    id: 'q20',
    category: 'Payment Options',
    categoryIcon: '💰',
    title: 'Do you plan to use a payment gateway like Stripe or PayPal?',
    type: 'dropdown',
    answers: [
      { id: 'a47', text: 'Yes, Stripe' },
      { id: 'a48', text: 'Yes, PayPal' },
      { id: 'a49', text: 'Yes, both' },
      { id: 'a50', text: 'No' },
    ],
  },
  {
    id: 'q21',
    category: 'Payment Options',
    categoryIcon: '💰',
    title: 'What is your cancellation policy?',
    type: 'dropdown',
    answers: [
      { id: 'a51', text: 'Flexible' },
      { id: 'a52', text: 'Moderate' },
      { id: 'a53', text: 'Strict' },
      { id: 'a54', text: 'Non-refundable' },
    ],
  },

  // Content and Branding
  {
    id: 'q22',
    category: 'Content & Branding',
    categoryIcon: '🎨',
    title: 'Do you have existing branding materials (logo, colors, fonts)?',
    type: 'dropdown',
    answers: [
      { id: 'a55', text: 'Yes, complete branding' },
      { id: 'a56', text: 'Yes, partial branding' },
      { id: 'a57', text: 'No, need help' },
    ],
  },
  {
    id: 'q23',
    category: 'Content & Branding',
    categoryIcon: '🎨',
    title: 'What style and tone would you like for the website?',
    type: 'dropdown',
    answers: [
      { id: 'a58', text: 'Formal' },
      { id: 'a59', text: 'Welcoming' },
      { id: 'a60', text: 'Casual' },
      { id: 'a61', text: 'Luxurious' },
      { id: 'a62', text: 'Modern' },
    ],
  },
  {
    id: 'q24',
    category: 'Content & Branding',
    categoryIcon: '🎨',
    title: 'Do you want to feature guest reviews on your site?',
    type: 'dropdown',
    answers: [
      { id: 'a63', text: 'Yes, from all platforms' },
      { id: 'a64', text: 'Yes, from Google/TripAdvisor' },
      { id: 'a65', text: 'No' },
    ],
  },
  {
    id: 'q25',
    category: 'Content & Branding',
    categoryIcon: '🎨',
    title: 'What sections do you want on your website?',
    type: 'checkbox',
    answers: [
      { id: 'a66', text: 'Home' },
      { id: 'a67', text: 'Rooms' },
      { id: 'a68', text: 'Booking' },
      { id: 'a69', text: 'About Us' },
      { id: 'a70', text: 'Contact' },
      { id: 'a71', text: 'Blog' },
      { id: 'a72', text: 'Gallery' },
      { id: 'a73', text: 'Testimonials' },
    ],
  },
  {
    id: 'q26',
    category: 'Content & Branding',
    categoryIcon: '🎨',
    title: 'Would you like a blog on your website?',
    type: 'dropdown',
    answers: [
      { id: 'a74', text: 'Yes' },
      { id: 'a75', text: 'No' },
      { id: 'a76', text: 'Maybe later' },
    ],
  },
  {
    id: 'q27',
    category: 'Content & Branding',
    categoryIcon: '🎨',
    title: 'If yes, what blog topics would you like to cover?',
    type: 'textarea',
  },

  // SEO & Local SEO Optimization
  {
    id: 'q28',
    category: 'SEO & Local Optimization',
    categoryIcon: '🔍',
    title: 'What keywords would you like to rank for?',
    type: 'textarea',
  },
  {
    id: 'q29',
    category: 'SEO & Local Optimization',
    categoryIcon: '🔍',
    title: 'Are there specific attractions or landmarks near your BnB?',
    type: 'textarea',
  },
  {
    id: 'q30',
    category: 'SEO & Local Optimization',
    categoryIcon: '🔍',
    title: 'Do you have a Google My Business profile set up?',
    type: 'dropdown',
    answers: [
      { id: 'a77', text: 'Yes, active' },
      { id: 'a78', text: 'Yes, but needs update' },
      { id: 'a79', text: 'No, need help' },
    ],
  },
  {
    id: 'q31',
    category: 'SEO & Local Optimization',
    categoryIcon: '🔍',
    title: 'Are there local events or seasonal activities to promote?',
    type: 'textarea',
  },

  // Image Content
  {
    id: 'q32',
    category: 'Image Content',
    categoryIcon: '📸',
    title: 'Do you have high-quality images for each room?',
    type: 'dropdown',
    answers: [
      { id: 'a80', text: 'Yes, professional photos' },
      { id: 'a81', text: 'Yes, but need enhancement' },
      { id: 'a82', text: 'No, need photography help' },
    ],
  },
  {
    id: 'q33',
    category: 'Image Content',
    categoryIcon: '📸',
    title: 'What kind of images would you like to showcase?',
    type: 'checkbox',
    answers: [
      { id: 'a83', text: 'Exterior' },
      { id: 'a84', text: 'Rooms' },
      { id: 'a85', text: 'Amenities' },
      { id: 'a86', text: 'Local attractions' },
      { id: 'a87', text: 'Guest experiences' },
    ],
  },
  {
    id: 'q34',
    category: 'Image Content',
    categoryIcon: '📸',
    title: 'Would you like a gallery or slideshow feature?',
    type: 'dropdown',
    answers: [
      { id: 'a88', text: 'Yes, gallery' },
      { id: 'a89', text: 'Yes, slideshow' },
      { id: 'a90', text: 'Yes, both' },
      { id: 'a91', text: 'No' },
    ],
  },
  {
    id: 'q35',
    category: 'Image Content',
    categoryIcon: '📸',
    title: 'Would you like images optimized for fast loading?',
    type: 'dropdown',
    answers: [
      { id: 'a92', text: 'Yes, WebP with lazy loading' },
      { id: 'a93', text: 'Yes, basic optimization' },
      { id: 'a94', text: 'No' },
    ],
  },

  // Social Media & Contact
  {
    id: 'q36',
    category: 'Social Media & Contact',
    categoryIcon: '📱',
    title: 'What is your preferred contact method for guests?',
    type: 'checkbox',
    answers: [
      { id: 'a95', text: 'Phone' },
      { id: 'a96', text: 'Email' },
      { id: 'a97', text: 'WhatsApp' },
      { id: 'a98', text: 'Contact Form' },
    ],
  },
  {
    id: 'q37',
    category: 'Social Media & Contact',
    categoryIcon: '📱',
    title: 'Would you like a live chat feature on the website?',
    type: 'dropdown',
    answers: [
      { id: 'a99', text: 'Yes' },
      { id: 'a100', text: 'No' },
      { id: 'a101', text: 'Maybe later' },
    ],
  },

  // Analytics & Tools
  {
    id: 'q38',
    category: 'Analytics & Tools',
    categoryIcon: '📊',
    title: 'Would you like to track website traffic with Google Analytics?',
    type: 'dropdown',
    answers: [
      { id: 'a102', text: 'Yes' },
      { id: 'a103', text: 'No' },
      { id: 'a104', text: 'Not sure' },
    ],
  },
  {
    id: 'q39',
    category: 'Analytics & Tools',
    categoryIcon: '📊',
    title: 'Do you need help setting up Google Search Console?',
    type: 'dropdown',
    answers: [
      { id: 'a105', text: 'Yes' },
      { id: 'a106', text: 'No' },
      { id: 'a107', text: 'Already set up' },
    ],
  },

  // Additional Features
  {
    id: 'q40',
    category: 'Additional Features',
    categoryIcon: '⚙️',
    title: 'Are there any additional features you would like?',
    type: 'checkbox',
    answers: [
      { id: 'a108', text: 'Multi-language support' },
      { id: 'a109', text: 'Special offers page' },
      { id: 'a110', text: 'Booking confirmation emails' },
      { id: 'a111', text: 'Newsletter signup' },
      { id: 'a112', text: 'Virtual tour' },
      { id: 'a113', text: 'Map integration' },
    ],
  },
  {
    id: 'q41',
    category: 'Additional Features',
    categoryIcon: '⚙️',
    title: 'Do you have a domain name and hosting provider?',
    type: 'dropdown',
    answers: [
      { id: 'a114', text: 'Yes, both' },
      { id: 'a115', text: 'Yes, domain only' },
      { id: 'a116', text: 'No, need help' },
    ],
  },
  // -----------------------------
  // Added for Lake House BnB checklist
  // -----------------------------
  // Property / Branding
  {
    id: 'q42',
    category: 'Content & Branding',
    categoryIcon: '🎨',
    title: 'Company mission statement and values',
    type: 'textarea',
  },
  {
    id: 'q43',
    category: 'Content & Branding',
    categoryIcon: '🎨',
    title: 'Property description and history',
    type: 'textarea',
  },
  {
    id: 'q44',
    category: 'Content & Branding',
    categoryIcon: '🎨',
    title: 'Owner/manager names and profile photo links (if available)',
    type: 'textarea',
  },
  {
    id: 'q45',
    category: 'Content & Branding',
    categoryIcon: '🎨',
    title: 'Company registration details and certifications',
    type: 'textarea',
  },
  {
    id: 'q46',
    category: 'Content & Branding',
    categoryIcon: '🎨',
    title: 'Official logo URL and brand colors (hex codes)',
    type: 'textarea',
  },

  // Pricing / Availability / Payments
  {
    id: 'q47',
    category: 'Payment Options',
    categoryIcon: '💰',
    title: 'Exact nightly rates per unit (peak vs off-season) + currency',
    type: 'textarea',
  },
  {
    id: 'q48',
    category: 'Payment Options',
    categoryIcon: '💰',
    title: 'Minimum stay requirements (per season/rule)',
    type: 'textarea',
  },
  {
    id: 'q49',
    category: 'Payment Options',
    categoryIcon: '💰',
    title: 'Maximum occupancy per unit/room (not just overall)',
    type: 'textarea',
  },
  {
    id: 'q50',
    category: 'Payment Options',
    categoryIcon: '💰',
    title: 'Deposit requirements (amount or %, and when it is due)',
    type: 'textarea',
  },
  {
    id: 'q51',
    category: 'Payment Options',
    categoryIcon: '💰',
    title: 'Payment schedule (deposit date, balance due date, and deadlines)',
    type: 'textarea',
  },
  {
    id: 'q52',
    category: 'Payment Options',
    categoryIcon: '💰',
    title: 'Bank details for transfers (if used)',
    type: 'textarea',
  },
  {
    id: 'q53',
    category: 'Payment Options',
    categoryIcon: '💰',
    title: 'Stripe/PayPal setup details (if desired)',
    type: 'textarea',
  },
  {
    id: 'q54',
    category: 'Payment Options',
    categoryIcon: '💰',
    title: 'Refund policy details (timing windows, % refunds, what is refundable)',
    type: 'textarea',
  },
  {
    id: 'q55',
    category: 'Payment Options',
    categoryIcon: '💰',
    title: 'Preferred currency(s) (KES, USD, etc.)',
    type: 'text',
  },

  // Calendar / blocked dates / closures
  {
    id: 'q56',
    category: 'Booking System & Availability',
    categoryIcon: '📅',
    title: 'Blocked dates / maintenance days / private events (list dates or rules)',
    type: 'textarea',
  },
  {
    id: 'q57',
    category: 'Booking System & Availability',
    categoryIcon: '📅',
    title: 'Peak season dates (start/end) and any peak-only rules',
    type: 'textarea',
  },
  {
    id: 'q58',
    category: 'Booking System & Availability',
    categoryIcon: '📅',
    title: 'Off-season dates (start/end) and any off-season rules',
    type: 'textarea',
  },
  {
    id: 'q59',
    category: 'Booking System & Availability',
    categoryIcon: '📅',
    title: 'Holiday closures (dates) and special holiday minimum/maximum stay',
    type: 'textarea',
  },

  // Amenities / services pricing
  {
    id: 'q60',
    category: 'Amenities & Services',
    categoryIcon: '🛎️',
    title: 'Complete list of amenities with descriptions (for each amenity)',
    type: 'textarea',
  },
  {
    id: 'q61',
    category: 'Amenities & Services',
    categoryIcon: '🛎️',
    title: 'Chef availability (yes/no), specialties, and pricing',
    type: 'textarea',
  },
  {
    id: 'q62',
    category: 'Amenities & Services',
    categoryIcon: '🛎️',
    title: 'Laundry service details and pricing (what is included?)',
    type: 'textarea',
  },
  {
    id: 'q63',
    category: 'Amenities & Services',
    categoryIcon: '🛎️',
    title: 'Airport transfer pricing and availability (pickup/drop-off locations)',
    type: 'textarea',
  },
  {
    id: 'q64',
    category: 'Amenities & Services',
    categoryIcon: '🛎️',
    title: 'Water sports/activities available (with pricing if any)',
    type: 'textarea',
  },
  {
    id: 'q65',
    category: 'Amenities & Services',
    categoryIcon: '🛎️',
    title: 'Guided tour options (what tours + pricing)',
    type: 'textarea',
  },
  {
    id: 'q66',
    category: 'Amenities & Services',
    categoryIcon: '🛎️',
    title: 'Event hosting capacity and pricing (max guests, packages)',
    type: 'textarea',
  },
  {
    id: 'q67',
    category: 'Amenities & Services',
    categoryIcon: '🛎️',
    title: 'Pet policy details (allowed pets, fees, limits/restrictions)',
    type: 'textarea',
  },
  {
    id: 'q68',
    category: 'Amenities & Services',
    categoryIcon: '🛎️',
    title: 'Housekeeping schedule (how often + what is included)',
    type: 'textarea',
  },
  {
    id: 'q69',
    category: 'Amenities & Services',
    categoryIcon: '🛎️',
    title: 'Security personnel details (if applicable) + emergency process',
    type: 'textarea',
  },
  {
    id: 'q70',
    category: 'Amenities & Services',
    categoryIcon: '🛎️',
    title: 'Manager/concierge contact workflow (who responds and response expectations)',
    type: 'textarea',
  },
  {
    id: 'q71',
    category: 'Amenities & Services',
    categoryIcon: '🛎️',
    title: 'Emergency contact person details (name + phone/email)',
    type: 'textarea',
  },

  // Media / images / tours
  {
    id: 'q72',
    category: 'Image Content',
    categoryIcon: '📸',
    title: 'Photo links/files for each required section (rooms, exterior/common areas, kitchen/dining, lake view, activities)',
    type: 'textarea',
  },
  {
    id: 'q73',
    category: 'Image Content',
    categoryIcon: '📸',
    title: 'Staff/team photos links (names + roles)',
    type: 'textarea',
  },
  {
    id: 'q74',
    category: 'Image Content',
    categoryIcon: '📸',
    title: '360 virtual tour or video walkthrough link/file',
    type: 'text',
  },
  {
    id: 'q75',
    category: 'Image Content',
    categoryIcon: '📸',
    title: 'Drone footage link/file',
    type: 'text',
  },

  // Location / attractions / emergency services
  {
    id: 'q76',
    category: 'SEO & Local Optimization',
    categoryIcon: '🔍',
    title: 'GPS coordinates of the property (latitude, longitude)',
    type: 'text',
  },
  {
    id: 'q77',
    category: 'SEO & Local Optimization',
    categoryIcon: '🔍',
    title: 'Distances to major attractions/landmarks (list: attraction + km/min)',
    type: 'textarea',
  },
  {
    id: 'q78',
    category: 'SEO & Local Optimization',
    categoryIcon: '🔍',
    title: 'Driving time from Nairobi (approx) + best route notes',
    type: 'textarea',
  },
  {
    id: 'q79',
    category: 'SEO & Local Optimization',
    categoryIcon: '🔍',
    title: 'Nearby restaurants and shops (names + approximate distance)',
    type: 'textarea',
  },
  {
    id: 'q80',
    category: 'SEO & Local Optimization',
    categoryIcon: '🔍',
    title: 'Transportation options (car rental, taxi services) and recommendations',
    type: 'textarea',
  },
  {
    id: 'q81',
    category: 'SEO & Local Optimization',
    categoryIcon: '🔍',
    title: 'Emergency services nearby (hospital/clinic + police/fire contacts)',
    type: 'textarea',
  },
  {
    id: 'q82',
    category: 'SEO & Local Optimization',
    categoryIcon: '🔍',
    title: 'Local activities and tour operators (what + contact/link)',
    type: 'textarea',
  },
  {
    id: 'q83',
    category: 'SEO & Local Optimization',
    categoryIcon: '🔍',
    title: 'Meta description text for key pages (copy per page)',
    type: 'textarea',
  },
  {
    id: 'q84',
    category: 'SEO & Local Optimization',
    categoryIcon: '🔍',
    title: 'Favicon file name or URL preference',
    type: 'text',
  },

  // Reviews / testimonials
  {
    id: 'q85',
    category: 'Content & Branding',
    categoryIcon: '🎨',
    title: 'Real guest reviews to feature (paste text or provide links)',
    type: 'textarea',
  },
  {
    id: 'q86',
    category: 'Content & Branding',
    categoryIcon: '🎨',
    title: 'Average rating across platforms (value + sources)',
    type: 'text',
  },
  {
    id: 'q87',
    category: 'Content & Branding',
    categoryIcon: '🎨',
    title: 'Permission to use guest names/photos (yes/no + details)',
    type: 'textarea',
  },
  {
    id: 'q88',
    category: 'Content & Branding',
    categoryIcon: '🎨',
    title: 'Video testimonials links (if available)',
    type: 'textarea',
  },
  {
    id: 'q89',
    category: 'Content & Branding',
    categoryIcon: '🎨',
    title: 'Guest photos from actual stays (links/album) + permission notes',
    type: 'textarea',
  },

  // Marketing / promotions
  {
    id: 'q90',
    category: 'Additional Features',
    categoryIcon: '⚙️',
    title: 'Current promotional offers/discounts (what/when/how much)',
    type: 'textarea',
  },
  {
    id: 'q91',
    category: 'Additional Features',
    categoryIcon: '⚙️',
    title: 'Seasonal pricing variation notes (if different from nightly rates)',
    type: 'textarea',
  },
  {
    id: 'q92',
    category: 'Additional Features',
    categoryIcon: '⚙️',
    title: 'Group booking discounts (rules + how to apply)',
    type: 'textarea',
  },
  {
    id: 'q93',
    category: 'Additional Features',
    categoryIcon: '⚙️',
    title: 'Long-stay discounts (rules + minimum duration)',
    type: 'textarea',
  },
  {
    id: 'q94',
    category: 'Additional Features',
    categoryIcon: '⚙️',
    title: 'Loyalty program details (if any)',
    type: 'textarea',
  },
  {
    id: 'q95',
    category: 'Additional Features',
    categoryIcon: '⚙️',
    title: 'Referral program details (if any)',
    type: 'textarea',
  },
  {
    id: 'q96',
    category: 'Additional Features',
    categoryIcon: '⚙️',
    title: 'Newsletter campaign email address (for sending newsletters)',
    type: 'text',
  },
  {
    id: 'q97',
    category: 'Additional Features',
    categoryIcon: '⚙️',
    title: 'Desired analytics/reporting metrics (what reports do you want?)',
    type: 'textarea',
  },

  // Technical integration
  {
    id: 'q98',
    category: 'Analytics & Tools',
    categoryIcon: '📊',
    title: 'Firebase setup needed (project name + which features/collections to use; do not paste private keys)',
    type: 'textarea',
  },
  {
    id: 'q99',
    category: 'Analytics & Tools',
    categoryIcon: '📊',
    title: 'Backblaze B2 setup (bucket name + where images should be stored; do not paste secrets)',
    type: 'textarea',
  },
  {
    id: 'q100',
    category: 'Analytics & Tools',
    categoryIcon: '📊',
    title: 'Google Analytics ID (e.g., G-XXXXXXXXXX)',
    type: 'text',
  },
  {
    id: 'q101',
    category: 'Analytics & Tools',
    categoryIcon: '📊',
    title: 'Google Maps API key (optional) or confirm we will use a proxy approach',
    type: 'textarea',
  },
  {
    id: 'q102',
    category: 'Analytics & Tools',
    categoryIcon: '📊',
    title: 'Email service provider details (SendGrid/Mailgun/etc.) + from-address',
    type: 'textarea',
  },
  {
    id: 'q103',
    category: 'Analytics & Tools',
    categoryIcon: '📊',
    title: 'SMS service provider details (Twilio/etc.) + any sender IDs',
    type: 'textarea',
  },

  // Policies / Legal
  {
    id: 'q104',
    category: 'Policies & Legal',
    categoryIcon: '🛡️',
    title: 'Terms and conditions (paste text or provide a document link)',
    type: 'textarea',
  },
  {
    id: 'q105',
    category: 'Policies & Legal',
    categoryIcon: '🛡️',
    title: 'Privacy policy (paste text or provide a document link)',
    type: 'textarea',
  },
  {
    id: 'q106',
    category: 'Policies & Legal',
    categoryIcon: '🛡️',
    title: 'House rules (quiet hours, smoking, visitors, etc.)',
    type: 'textarea',
  },
  {
    id: 'q107',
    category: 'Policies & Legal',
    categoryIcon: '🛡️',
    title: 'Security deposit policy (amount + when returned)',
    type: 'textarea',
  },
  {
    id: 'q108',
    category: 'Policies & Legal',
    categoryIcon: '🛡️',
    title: 'Damage policy (what counts as damage + process)',
    type: 'textarea',
  },
  {
    id: 'q109',
    category: 'Policies & Legal',
    categoryIcon: '🛡️',
    title: 'Guest conduct expectations (behavior standards + enforcement)',
    type: 'textarea',
  },
  {
    id: 'q110',
    category: 'Policies & Legal',
    categoryIcon: '🛡️',
    title: 'Data protection compliance notes (GDPR/cookies/etc.)',
    type: 'textarea',
  },
  {
    id: 'q111',
    category: 'Policies & Legal',
    categoryIcon: '🛡️',
    title: 'Detailed cancellation and refund policy (timing windows, amounts)',
    type: 'textarea',
  },
];

export default function BnbQuestionnaireForm({ wizardStep }: { wizardStep?: string } = {}) {
  const [, navigate] = useLocation();
  const [questions, setQuestions] = useState<Question[]>(defaultQuestions);
  const [expandedCategory, setExpandedCategory] = useState<string | null>('Property Information');
  const [activeStep, setActiveStep] = useState<string>('Property Information');
  const [newQuestionTitle, setNewQuestionTitle] = useState('');
  const [newQuestionType, setNewQuestionType] = useState<'text' | 'textarea' | 'dropdown' | 'checkbox'>('text');
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [contactInfo, setContactInfo] = useState<ContactInfo>({
    ownerName: '',
    email: '',
    phone: '',
    whatsapp: '',
    address: '',
    instagram: '',
    facebook: '',
    x: '',
    youtube: '',
    tiktok: '',
  });
  const [lastSavedTime, setLastSavedTime] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [sendViaWhatsApp, setSendViaWhatsApp] = useState(false);
  const textareaRefs = useRef<{ [key: string]: HTMLTextAreaElement | null }>({});

  const slugify = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  const scrollToId = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const scrollToCategory = (category: string) => scrollToId(`qn-category-${slugify(category)}`);

  const handleExitQuestionnaire = () => {
    if (
      window.confirm(
        'Leave the questionnaire? Your answers are auto-saved in this browser—you can return anytime.',
      )
    ) {
      navigate('/');
    }
  };

  const toggleDropdownOption = (questionId: string, optionText: string, checked: boolean) => {
    setQuestions(prev =>
      prev.map(q => {
        if (q.id !== questionId) return q;
        const cur = getDropdownSelections(q);
        const next = checked ? [...cur.filter(t => t !== optionText), optionText] : cur.filter(t => t !== optionText);
        return { ...q, value: next };
      }),
    );
  };

  // Load data from localStorage on mount
  useEffect(() => {
    const loadSavedData = () => {
      try {
        const savedData = localStorage.getItem(STORAGE_KEY);
        if (savedData) {
          const parsed: SaveState = JSON.parse(savedData);
          setQuestions(migrateLoadedQuestions(parsed.questions));
          setContactInfo(parsed.contactInfo);
          setAdditionalInfo(parsed.additionalInfo);
          setExpandedCategory(parsed.expandedCategory);
          setActiveStep(parsed.expandedCategory ?? "contact");
          setLastSavedTime(parsed.lastSaved);
          toast.success('Previous progress restored!');
        }
      } catch (error) {
        console.error('Error loading saved data:', error);
      }
    };

    loadSavedData();
  }, []);

  // Auto-save to localStorage
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      saveToLocalStorage();
    }, AUTO_SAVE_INTERVAL);

    return () => clearInterval(autoSaveInterval);
  }, [questions, contactInfo, additionalInfo, expandedCategory]);

  // Auto-expand textareas
  useEffect(() => {
    Object.values(textareaRefs.current).forEach(textarea => {
      if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 400) + 'px';
      }
    });
  }, [questions, additionalInfo]);

  const saveToLocalStorage = () => {
    try {
      setIsSaving(true);
      const saveState: SaveState = {
        questions,
        contactInfo,
        additionalInfo,
        expandedCategory,
        lastSaved: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saveState));
      setLastSavedTime(Date.now());
      setIsSaving(false);
    } catch (error) {
      console.error('Error saving to localStorage:', error);
      setIsSaving(false);
    }
  };

  const handleClearAllData = () => {
    if (window.confirm('Are you sure you want to clear all saved data? This cannot be undone.')) {
      localStorage.removeItem(STORAGE_KEY);
      setQuestions(defaultQuestions);
      setContactInfo({
        ownerName: '',
        email: '',
        phone: '',
        whatsapp: '',
        address: '',
        instagram: '',
        facebook: '',
        x: '',
        youtube: '',
        tiktok: '',
      });
      setAdditionalInfo('');
      setExpandedCategory('Property Information');
      setActiveStep('Property Information');
      setLastSavedTime(null);
      toast.success('All data cleared');
    }
  };

  const handleAnswerChange = (questionId: string, answer: string | string[]) => {
    setQuestions(questions.map(q =>
      q.id === questionId ? { ...q, value: answer } : q
    ));
  };

  const handleAddCustomAnswer = (questionId: string, customAnswer: string) => {
    if (!customAnswer.trim()) {
      toast.error('Please enter a custom answer');
      return;
    }

    setQuestions(questions.map(q => {
      if (q.id === questionId) {
        const newCustomAnswer: Answer = {
          id: `custom-${Date.now()}`,
          text: customAnswer,
          isCustom: true,
        };
        return {
          ...q,
          customAnswers: [...(q.customAnswers || []), newCustomAnswer],
        };
      }
      return q;
    }));

    toast.success('Custom answer added!');
  };

  const handleAddQuestion = () => {
    if (!newQuestionTitle.trim()) {
      toast.error('Please enter a question');
      return;
    }

    const newQuestion: Question = {
      id: `custom-q-${Date.now()}`,
      category: 'Custom Questions',
      categoryIcon: '❓',
      title: newQuestionTitle,
      type: newQuestionType,
      isCustomQuestion: true,
      answers: [],
      customAnswers: [],
      value: newQuestionType === 'dropdown' || newQuestionType === 'checkbox' ? [] : undefined,
    };

    setQuestions([...questions, newQuestion]);
    setNewQuestionTitle('');
    setNewQuestionType('text');
    setShowAddQuestion(false);
    toast.success('Question added successfully!');
  };

  const handleDeleteQuestion = (questionId: string) => {
    setQuestions(questions.filter(q => q.id !== questionId));
    toast.success('Question deleted');
  };

  const handleContactInfoChange = (field: keyof ContactInfo, value: string) => {
    setContactInfo(prev => ({ ...prev, [field]: value }));
  };

  const calculateProgress = (): number => {
    const answeredQuestions = questions.filter(q => q.value && (Array.isArray(q.value) ? q.value.length > 0 : q.value.toString().trim() !== '')).length;
    return Math.round((answeredQuestions / questions.length) * 100);
  };

  const generateMarkdown = (): string => {
    let markdown = '# BnB Questionnaire Response\n\n';
    markdown += `**Submitted on:** ${new Date().toLocaleString()}\n\n`;

    // Contact Information Section
    markdown += `## 📞 Owner Contact Information\n\n`;
    if (contactInfo.ownerName) markdown += `**Owner Name:** ${contactInfo.ownerName}\n\n`;
    if (contactInfo.email) markdown += `**Email:** ${contactInfo.email}\n\n`;
    if (contactInfo.phone) markdown += `**Phone:** ${contactInfo.phone}\n\n`;
    if (contactInfo.whatsapp) markdown += `**WhatsApp:** ${contactInfo.whatsapp}\n\n`;
    if (contactInfo.address) markdown += `**Address:** ${contactInfo.address}\n\n`;
    
    markdown += `### Social Media\n\n`;
    if (contactInfo.instagram) markdown += `- **Instagram:** ${contactInfo.instagram}\n`;
    if (contactInfo.facebook) markdown += `- **Facebook:** ${contactInfo.facebook}\n`;
    if (contactInfo.x) markdown += `- **X (Twitter):** ${contactInfo.x}\n`;
    if (contactInfo.youtube) markdown += `- **YouTube:** ${contactInfo.youtube}\n`;
    if (contactInfo.tiktok) markdown += `- **TikTok:** ${contactInfo.tiktok}\n`;
    markdown += '\n';

    const categories = Array.from(new Set(questions.map(q => q.category)));

    for (const category of categories) {
      const categoryQuestions = questions.filter(q => q.category === category);
      const categoryIcon = categoryQuestions[0]?.categoryIcon || '❓';

      markdown += `## ${categoryIcon} ${category}\n\n`;

      for (const question of categoryQuestions) {
        markdown += `### ${question.title}\n\n`;

        if (question.value) {
          if (Array.isArray(question.value)) {
            markdown += `- ${question.value.join('\n- ')}\n\n`;
          } else {
            markdown += `${question.value}\n\n`;
          }
        } else {
          markdown += `*No answer provided*\n\n`;
        }
      }
    }

    if (additionalInfo.trim()) {
      markdown += `## 📝 Additional Information\n\n${additionalInfo}\n\n`;
    }

    return markdown;
  };

  const handleSubmit = async () => {
    if (!contactInfo.ownerName.trim()) {
      toast.error('Please enter your name');
      return;
    }
    if (!sendViaWhatsApp && !contactInfo.email.trim()) {
      toast.error('Please enter your email address, or choose WhatsApp to send there instead');
      return;
    }

    setIsSubmitting(true);
    setShowThankYou(true);

    const markdownContent = generateMarkdown();

    try {
      if (sendViaWhatsApp) {
        const waText = `Hi Hannington,\n\nHere is my BnB questionnaire:\n\n${markdownContent}`;
        const waUrl = `https://wa.me/${SUBMIT_WHATSAPP_E164}?text=${encodeURIComponent(waText)}`;
        window.open(waUrl, '_blank', 'noopener,noreferrer');
        setTimeout(() => {
          toast.success('Opening WhatsApp…');
        }, 300);
      } else {
        const emailData = {
          to: 'hanningtonkuria5@gmail.com',
          subject: 'Hi Hannington, My Questionnaire is Ready',
          body: markdownContent,
        };
        const mailtoLink = `mailto:${emailData.to}?subject=${encodeURIComponent(emailData.subject)}&body=${encodeURIComponent(emailData.body)}`;
        window.location.href = mailtoLink;
        setTimeout(() => {
          toast.success('Questionnaire submitted! Opening your email client...');
        }, 1000);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to submit questionnaire');
      setShowThankYou(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = Array.from(new Set(questions.map(q => q.category)));
  const progress = calculateProgress();

  const isWizard = typeof wizardStep === "string" && wizardStep.length > 0;
  const wizardCategory = isWizard
    ? categories.find((c) => slugify(c) === wizardStep) ?? null
    : null;

  const visibleCategories = isWizard ? (wizardCategory ? [wizardCategory] : []) : categories;
  const showContactSection = isWizard ? wizardStep === "contact" || wizardStep === "submit" : true;
  const showCategorySection = isWizard ? wizardCategory !== null : true;
  const showAdditionalSection = isWizard
    ? wizardStep === "additional-info" || wizardStep === "submit"
    : true;
  const showSubmitSection = isWizard ? wizardStep === "submit" : true;
  const showAddQuestionSection = isWizard ? wizardCategory !== null : true;

  useEffect(() => {
    if (!isWizard) return;
    if (wizardCategory) setExpandedCategory(wizardCategory);
  }, [isWizard, wizardCategory]);

  const formatLastSavedTime = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins === 0) return 'Just now';
    if (diffMins === 1) return '1 minute ago';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    
    return date.toLocaleDateString();
  };

  const answeredCount = questions.filter(
    q => q.value && (Array.isArray(q.value) ? q.value.length > 0 : q.value.toString().trim() !== ''),
  ).length;

  return (
    <div className="min-h-screen bg-background pt-[8.75rem] md:pt-[8.5rem]">
      {/* Thank You Animation */}
      {showThankYou && (
        <div className="fixed inset-0 flex items-center justify-center z-[60] pointer-events-none">
          <div className="animate-in fade-in zoom-in duration-500">
            <div className="text-center">
              <div className="mb-4 text-8xl animate-bounce">🎉</div>
              <h2 className="text-4xl font-bold text-primary mb-2 animate-in fade-in slide-in-from-bottom-4 duration-700">
                Thank You!
              </h2>
              <p className="text-lg text-muted-foreground animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
                Your questionnaire is being prepared...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-4xl w-full my-8 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-bold text-foreground">Preview Your Answers</h2>
              <button
                onClick={() => setShowPreview(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Contact Info Preview */}
            <div className="mb-8 pb-6 border-b border-border">
              <h3 className="text-xl font-bold text-foreground mb-4">📞 Contact Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {contactInfo.ownerName && <div><span className="font-semibold">Name:</span> {contactInfo.ownerName}</div>}
                {contactInfo.email && <div><span className="font-semibold">Email:</span> {contactInfo.email}</div>}
                {contactInfo.phone && <div><span className="font-semibold">Phone:</span> {contactInfo.phone}</div>}
                {contactInfo.whatsapp && <div><span className="font-semibold">WhatsApp:</span> {contactInfo.whatsapp}</div>}
                {contactInfo.address && <div className="col-span-2"><span className="font-semibold">Address:</span> {contactInfo.address}</div>}
              </div>
              {(contactInfo.instagram || contactInfo.facebook || contactInfo.x || contactInfo.youtube || contactInfo.tiktok) && (
                <div className="mt-4 pt-4 border-t border-border">
                  <h4 className="font-semibold mb-2">Social Media:</h4>
                  <div className="space-y-1 text-sm">
                    {contactInfo.instagram && <div>📷 Instagram: {contactInfo.instagram}</div>}
                    {contactInfo.facebook && <div>👥 Facebook: {contactInfo.facebook}</div>}
                    {contactInfo.x && <div>𝕏 X: {contactInfo.x}</div>}
                    {contactInfo.youtube && <div>▶️ YouTube: {contactInfo.youtube}</div>}
                    {contactInfo.tiktok && <div>🎵 TikTok: {contactInfo.tiktok}</div>}
                  </div>
                </div>
              )}
            </div>

            {/* Questions Preview */}
            {categories.map(category => {
              const categoryQuestions = questions.filter(q => q.category === category);
              const categoryIcon = categoryQuestions[0]?.categoryIcon || '❓';

              return (
                <div key={category} className="mb-8 pb-6 border-b border-border last:border-b-0">
                  <h3 className="text-xl font-bold text-foreground mb-4">{categoryIcon} {category}</h3>
                  <div className="space-y-4">
                    {categoryQuestions.map(question => (
                      <div key={question.id}>
                        <h4 className="font-semibold text-foreground mb-1">{question.title}</h4>
                        <p className="text-muted-foreground whitespace-pre-wrap">
                          {question.value ? (
                            Array.isArray(question.value) ? question.value.join(', ') : question.value
                          ) : (
                            <span className="italic text-gray-400">No answer provided</span>
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Additional Info Preview */}
            {additionalInfo.trim() && (
              <div className="mb-8 pb-6 border-b border-border">
                <h3 className="text-xl font-bold text-foreground mb-4">📝 Additional Information</h3>
                <p className="text-muted-foreground whitespace-pre-wrap">{additionalInfo}</p>
              </div>
            )}

            <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="preview-send-whatsapp"
                  checked={sendViaWhatsApp}
                  onCheckedChange={v => setSendViaWhatsApp(v === true)}
                />
                <div className="grid gap-1 leading-none">
                  <Label htmlFor="preview-send-whatsapp" className="cursor-pointer font-medium">
                    Send via WhatsApp (+254&nbsp;759&nbsp;550133)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    If checked, your answers open in WhatsApp to that number. Otherwise your email app opens as before.
                  </p>
                </div>
              </div>
            </div>

            {/* Preview Actions */}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-stretch">
              <Button
                onClick={() => setShowPreview(false)}
                variant="outline"
                className="min-h-12 w-full sm:max-w-[200px]"
              >
                Back to Editing
              </Button>
              <Button
                onClick={handleSubmit}
                className="min-h-14 w-full flex-1 bg-primary px-8 text-lg font-semibold hover:bg-primary/90 text-primary-foreground sm:min-h-16"
              >
                Submit Questionnaire
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <div
        className="relative w-full h-64 bg-cover bg-center"
        style={{
          backgroundImage: 'url(https://d2xsxph8kpxj0f.cloudfront.net/310519663055487902/6S64Vmqk5bbML5Gx2o7Gz2/hero-bg-AhZNcNvxrvXQzpzVHASwhM.webp)',
        }}
      >
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative flex flex-col items-center justify-center h-full">
          <h1 className="text-5xl font-bold text-white drop-shadow-lg">HI GRACE 👋</h1>
          <p className="text-xl text-white/90 mt-2 drop-shadow">Let's build your perfect BnB website</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="container py-12 max-w-4xl">
        {/* Auto-Save Status Bar */}
        <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-lg flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Save className={`w-4 h-4 shrink-0 text-green-600 ${isSaving ? 'animate-spin' : ''}`} />
            <span className="text-sm text-green-700">
              {isSaving ? 'Saving...' : `Auto-saved ${formatLastSavedTime(lastSavedTime)}`}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleClearAllData}
              className="text-xs text-green-600 hover:text-green-700 underline"
            >
              Clear all data
            </button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={handleExitQuestionnaire}
            >
              Cancel / Exit
            </Button>
          </div>
        </div>

        {/* Info Section */}
        <div className="mb-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
          <h2 className="text-2xl font-bold text-foreground mb-2">BnB Questionnaire</h2>
          <p className="text-muted-foreground text-sm mb-2">
            Complete this questionnaire to provide all the details needed for your BnB website. Your progress is automatically saved every 5 seconds.
          </p>
          <p className="text-sm text-blue-700 font-semibold">
            💡 Tip: If you don't understand a question or it doesn't apply to your BnB, you can leave it blank and move on.
          </p>
        </div>

        {/* Step Navigation */}
        {isWizard ? (
          <div className="mb-8 p-4 bg-white rounded-lg border border-border">
            <div className="flex flex-wrap gap-2 items-center">
              <Button
                type="button"
                size="sm"
                variant={wizardStep === "contact" ? "default" : "outline"}
                onClick={() => navigate("/written-qns/contact")}
              >
                Contact
              </Button>

              {categories.map(category => {
                const categorySlug = slugify(category);
                return (
                  <Button
                    key={category}
                    type="button"
                    size="sm"
                    variant={wizardStep === categorySlug ? "default" : "outline"}
                    onClick={() => navigate(`/written-qns/${categorySlug}`)}
                  >
                    {category}
                  </Button>
                );
              })}

              <Button
                type="button"
                size="sm"
                variant={wizardStep === "additional-info" ? "default" : "outline"}
                onClick={() => navigate("/written-qns/additional-info")}
              >
                Additional
              </Button>
              <Button
                type="button"
                size="sm"
                variant={wizardStep === "submit" ? "default" : "outline"}
                onClick={() => navigate("/written-qns/submit")}
              >
                Submit
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Switch pages using the buttons above.</p>
          </div>
        ) : (
          <div className="mb-8 p-4 bg-white rounded-lg border border-border">
            <div className="flex flex-wrap gap-2 items-center">
              <Button
                type="button"
                size="sm"
                variant={activeStep === "contact" ? "default" : "outline"}
                onClick={() => {
                  setExpandedCategory(null);
                  setActiveStep("contact");
                  scrollToId("qn-contact");
                }}
              >
                Contact
              </Button>

              {categories.map(category => (
                <Button
                  key={category}
                  type="button"
                  size="sm"
                  variant={activeStep === category ? "default" : "outline"}
                  onClick={() => {
                    setExpandedCategory(category);
                    setActiveStep(category);
                    scrollToCategory(category);
                  }}
                >
                  {category}
                </Button>
              ))}

              <Button
                type="button"
                size="sm"
                variant={activeStep === "additional" ? "default" : "outline"}
                onClick={() => {
                  setExpandedCategory(null);
                  setActiveStep("additional");
                  scrollToId("qn-additional");
                }}
              >
                Additional
              </Button>
              <Button
                type="button"
                size="sm"
                variant={activeStep === "submit" ? "default" : "outline"}
                onClick={() => {
                  setExpandedCategory(null);
                  setActiveStep("submit");
                  scrollToId("qn-submit");
                }}
              >
                Submit
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Jump between sections without scrolling.</p>
          </div>
        )}

        {/* Contact Information Section */}
        {showContactSection && (
        <div id="qn-contact" className="mb-8 p-6 bg-white rounded-lg shadow-sm border border-border">
          <h3 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
            <span>📞</span> Your Contact Information
          </h3>
          <p className="text-muted-foreground mb-6 text-sm">
            Please provide your contact details so Hannington can reach you about your BnB website.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Owner Name */}
            <div>
              <Label htmlFor="owner-name" className="font-semibold">
                Your Name *
              </Label>
              <Input
                id="owner-name"
                placeholder="e.g., Grace"
                value={contactInfo.ownerName}
                onChange={e => handleContactInfoChange('ownerName', e.target.value)}
                className="bg-white mt-1"
              />
            </div>

            {/* Email */}
            <div>
              <Label htmlFor="owner-email" className="font-semibold">
                Email Address {sendViaWhatsApp ? '(optional if using WhatsApp)' : '*'}
              </Label>
              <Input
                id="owner-email"
                type="email"
                placeholder="e.g., grace@example.com"
                value={contactInfo.email}
                onChange={e => handleContactInfoChange('email', e.target.value)}
                className="bg-white mt-1"
              />
            </div>

            {/* Phone */}
            <div>
              <Label htmlFor="owner-phone" className="font-semibold">
                Phone Number
              </Label>
              <Input
                id="owner-phone"
                placeholder="e.g., +1 (555) 123-4567"
                value={contactInfo.phone}
                onChange={e => handleContactInfoChange('phone', e.target.value)}
                className="bg-white mt-1"
              />
            </div>

            {/* WhatsApp */}
            <div>
              <Label htmlFor="owner-whatsapp" className="font-semibold">
                WhatsApp Number
              </Label>
              <Input
                id="owner-whatsapp"
                placeholder="e.g., +1 (555) 123-4567"
                value={contactInfo.whatsapp}
                onChange={e => handleContactInfoChange('whatsapp', e.target.value)}
                className="bg-white mt-1"
              />
            </div>

            {/* Address */}
            <div className="md:col-span-2">
              <Label htmlFor="owner-address" className="font-semibold">
                Business Address
              </Label>
              <Textarea
                id="owner-address"
                placeholder="e.g., 123 Lake Street, City, Country"
                value={contactInfo.address}
                onChange={e => {
                  handleContactInfoChange('address', e.target.value);
                  textareaRefs.current['address'] = e.currentTarget;
                }}
                ref={el => { if (el) textareaRefs.current['address'] = el; }}
                className="bg-white mt-1 min-h-20 resize-none"
              />
            </div>
          </div>

          {/* Social Media Section */}
          <div className="mt-6 pt-6 border-t border-border">
            <h4 className="font-semibold text-foreground mb-4">Social Media Profiles</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Instagram */}
              <div>
                <Label htmlFor="instagram" className="font-semibold text-sm">
                  📷 Instagram
                </Label>
                <Input
                  id="instagram"
                  placeholder="@yourhandle or full URL"
                  value={contactInfo.instagram}
                  onChange={e => handleContactInfoChange('instagram', e.target.value)}
                  className="bg-white mt-1"
                />
              </div>

              {/* Facebook */}
              <div>
                <Label htmlFor="facebook" className="font-semibold text-sm">
                  👥 Facebook
                </Label>
                <Input
                  id="facebook"
                  placeholder="Page name or URL"
                  value={contactInfo.facebook}
                  onChange={e => handleContactInfoChange('facebook', e.target.value)}
                  className="bg-white mt-1"
                />
              </div>

              {/* X (Twitter) */}
              <div>
                <Label htmlFor="x" className="font-semibold text-sm">
                  𝕏 X (formerly Twitter)
                </Label>
                <Input
                  id="x"
                  placeholder="@yourhandle or URL"
                  value={contactInfo.x}
                  onChange={e => handleContactInfoChange('x', e.target.value)}
                  className="bg-white mt-1"
                />
              </div>

              {/* YouTube */}
              <div>
                <Label htmlFor="youtube" className="font-semibold text-sm">
                  ▶️ YouTube
                </Label>
                <Input
                  id="youtube"
                  placeholder="Channel name or URL"
                  value={contactInfo.youtube}
                  onChange={e => handleContactInfoChange('youtube', e.target.value)}
                  className="bg-white mt-1"
                />
              </div>

              {/* TikTok */}
              <div>
                <Label htmlFor="tiktok" className="font-semibold text-sm">
                  🎵 TikTok
                </Label>
                <Input
                  id="tiktok"
                  placeholder="@yourhandle or URL"
                  value={contactInfo.tiktok}
                  onChange={e => handleContactInfoChange('tiktok', e.target.value)}
                  className="bg-white mt-1"
                />
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Questions by Category */}
        {showCategorySection && (
        <div className="space-y-4">
          {visibleCategories.map(category => {
            const categoryQuestions = questions.filter(q => q.category === category);
            const categoryIcon = categoryQuestions[0]?.categoryIcon || '❓';
            const isExpanded = expandedCategory === category;

            return (
              <div key={category} className="border border-border rounded-lg overflow-hidden">
                {/* Category Header */}
                <button
                  id={`qn-category-${slugify(category)}`}
                  onClick={() => {
                    const next = isExpanded ? null : category;
                    setExpandedCategory(next);
                    setActiveStep(next ?? "contact");
                  }}
                  className="w-full flex items-center justify-between p-4 bg-white hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{categoryIcon}</span>
                    <h3 className="text-lg font-semibold text-foreground">{category}</h3>
                    <span className="text-sm text-muted-foreground">({categoryQuestions.length})</span>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-muted-foreground transition-transform ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Category Content */}
                {isExpanded && (
                  <div className="border-t border-border bg-white/50 p-4 space-y-6">
                    {categoryQuestions.map(question => (
                      <div key={question.id} className="space-y-3">
                        <div className="flex items-start justify-between">
                          <Label className="text-base font-semibold text-foreground">
                            {question.title}
                          </Label>
                          {question.isCustomQuestion && (
                            <button
                              onClick={() => handleDeleteQuestion(question.id)}
                              className="text-destructive hover:text-destructive/80 transition-colors p-1"
                              title="Delete question"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* Text Input */}
                        {question.type === 'text' && (
                          <Input
                            placeholder="Enter your answer..."
                            value={String(question.value ?? '')}
                            onChange={e => handleAnswerChange(question.id, e.target.value)}
                            className="bg-white"
                          />
                        )}

                        {/* Textarea */}
                        {question.type === 'textarea' && (
                          <Textarea
                            placeholder="Enter your answer..."
                            value={String(question.value ?? '')}
                            onChange={e => {
                              handleAnswerChange(question.id, e.target.value);
                              textareaRefs.current[question.id] = e.currentTarget;
                            }}
                            ref={el => { if (el) textareaRefs.current[question.id] = el; }}
                            className="bg-white resize-none"
                          />
                        )}

                        {/* Dropdown (multi-select) */}
                        {question.type === 'dropdown' && (
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">Select all that apply.</p>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-auto min-h-9 w-full justify-between whitespace-normal bg-white py-2 font-normal text-left"
                                >
                                  <span className="line-clamp-2 pr-2">
                                    {(() => {
                                      const sel = getDropdownSelections(question);
                                      if (sel.length === 0) {
                                        return 'Choose options…';
                                      }
                                      return sel.join(', ');
                                    })()}
                                  </span>
                                  <ChevronDown className="size-4 shrink-0 opacity-60" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent
                                className="max-h-72 w-[var(--radix-popover-trigger-width)] overflow-y-auto p-0"
                                align="start"
                              >
                                <div className="flex flex-col gap-1 p-2">
                                  {question.answers?.map(answer => {
                                    const sel = getDropdownSelections(question);
                                    const cid = `${question.id}-${answer.id}`;
                                    return (
                                      <label
                                        key={answer.id}
                                        htmlFor={cid}
                                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
                                      >
                                        <Checkbox
                                          id={cid}
                                          checked={sel.includes(answer.text)}
                                          onCheckedChange={checked =>
                                            toggleDropdownOption(question.id, answer.text, checked === true)
                                          }
                                        />
                                        <span className="text-sm">{answer.text}</span>
                                      </label>
                                    );
                                  })}
                                  {question.customAnswers?.map(answer => {
                                    const sel = getDropdownSelections(question);
                                    const cid = `${question.id}-${answer.id}`;
                                    return (
                                      <label
                                        key={answer.id}
                                        htmlFor={cid}
                                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
                                      >
                                        <Checkbox
                                          id={cid}
                                          checked={sel.includes(answer.text)}
                                          onCheckedChange={checked =>
                                            toggleDropdownOption(question.id, answer.text, checked === true)
                                          }
                                        />
                                        <span className="text-sm text-muted-foreground">{answer.text} (custom)</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                        )}

                        {/* Checkboxes */}
                        {question.type === 'checkbox' && (
                          <div className="space-y-2">
                            {question.answers?.map(answer => (
                              <div key={answer.id} className="flex items-center gap-2">
                                <Checkbox
                                  id={answer.id}
                                  checked={(question.value as string[])?.includes(answer.text) || false}
                                  onCheckedChange={checked => {
                                    const currentValues = (question.value as string[]) || [];
                                    const newValues = checked
                                      ? [...currentValues, answer.text]
                                      : currentValues.filter(v => v !== answer.text);
                                    handleAnswerChange(question.id, newValues);
                                  }}
                                />
                                <Label htmlFor={answer.id} className="font-normal cursor-pointer">
                                  {answer.text}
                                </Label>
                              </div>
                            ))}
                            {question.customAnswers?.map(answer => (
                              <div key={answer.id} className="flex items-center gap-2">
                                <Checkbox
                                  id={answer.id}
                                  checked={(question.value as string[])?.includes(answer.text) || false}
                                  onCheckedChange={checked => {
                                    const currentValues = (question.value as string[]) || [];
                                    const newValues = checked
                                      ? [...currentValues, answer.text]
                                      : currentValues.filter(v => v !== answer.text);
                                    handleAnswerChange(question.id, newValues);
                                  }}
                                />
                                <Label htmlFor={answer.id} className="font-normal cursor-pointer text-muted-foreground">
                                  {answer.text} (custom)
                                </Label>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add Custom Answer Option */}
                        {(question.type === 'dropdown' || question.type === 'checkbox') && (
                          <div className="pt-2 border-t border-border">
                            <AddCustomAnswerForm
                              onAdd={customAnswer => handleAddCustomAnswer(question.id, customAnswer)}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        )}

        {/* Add New Question Section */}
        {showAddQuestionSection && (
        <div className="mt-8 p-6 bg-white rounded-lg shadow-sm border border-border">
          {!showAddQuestion ? (
            <Button
              onClick={() => setShowAddQuestion(true)}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              size="lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Custom Question
            </Button>
          ) : (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Add a New Question</h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="question-title">Question</Label>
                  <Input
                    id="question-title"
                    placeholder="Enter your question..."
                    value={newQuestionTitle}
                    onChange={e => setNewQuestionTitle(e.target.value)}
                    className="bg-white"
                  />
                </div>
                <div>
                  <Label htmlFor="question-type">Question Type</Label>
                  <Select value={newQuestionType} onValueChange={v => setNewQuestionType(v as any)}>
                    <SelectTrigger id="question-type" className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Short Text</SelectItem>
                      <SelectItem value="textarea">Long Text</SelectItem>
                      <SelectItem value="dropdown">Dropdown</SelectItem>
                      <SelectItem value="checkbox">Multiple Choice</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleAddQuestion}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  Add Question
                </Button>
                <Button
                  onClick={() => setShowAddQuestion(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
        )}

        {/* Additional Information Section */}
        {showAdditionalSection && (
        <div id="qn-additional" className="mt-8 p-6 bg-white rounded-lg shadow-sm border border-border">
          <h3 className="text-lg font-semibold text-foreground mb-2">📝 Additional Information</h3>
          <p className="text-muted-foreground mb-4 text-sm">
            Is there any other information about your BnB that wasn't covered in the questionnaire? Share it here!
          </p>
          <Textarea
            placeholder="Write any additional details, special features, or information you'd like to include..."
            value={additionalInfo}
            onChange={e => {
              setAdditionalInfo(e.target.value);
              textareaRefs.current['additional'] = e.currentTarget;
            }}
            ref={el => { if (el) textareaRefs.current['additional'] = el; }}
            className="bg-white resize-none"
          />
        </div>
        )}

        {/* Submit Section */}
        {showSubmitSection && (
        <div id="qn-submit" className="mt-8 p-6 bg-accent/10 rounded-lg border border-accent">
          <h3 className="text-lg font-semibold text-foreground mb-2">Ready to Submit?</h3>
          <p className="text-muted-foreground mb-4">
            Review your answers before submitting. Your questionnaire will be compiled as a Markdown document and sent to Hannington.
          </p>
          <div className="mb-4 rounded-lg border border-border bg-background p-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="submit-send-whatsapp"
                checked={sendViaWhatsApp}
                onCheckedChange={v => setSendViaWhatsApp(v === true)}
              />
              <div className="grid gap-1 leading-none">
                <Label htmlFor="submit-send-whatsapp" className="cursor-pointer font-medium">
                  Send via WhatsApp (+254&nbsp;759&nbsp;550133)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Opens WhatsApp with your full questionnaire in the message. Leave unchecked to use email instead.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Button
              onClick={() => setShowPreview(true)}
              variant="outline"
              className="min-h-12 w-full sm:max-w-[220px]"
              size="lg"
            >
              <Eye className="w-5 h-5 mr-2" />
              Preview Answers
            </Button>
            <Button
              className="w-full flex-1 bg-primary px-10 py-7 text-lg font-semibold hover:bg-primary/90 text-primary-foreground sm:min-h-16 sm:text-xl"
              size="lg"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Questionnaire'}
            </Button>
          </div>
        </div>
        )}
      </div>

      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-30 border-b border-border bg-background/95 shadow-md backdrop-blur-md supports-[backdrop-filter]:bg-background/90"
        aria-live="polite"
      >
        <div className="pointer-events-auto mx-auto flex h-[4.5rem] max-w-4xl flex-col justify-center px-4 py-2">
          <div className="flex items-center gap-3">
            <h3 className="shrink-0 text-sm font-semibold text-foreground">Progress</h3>
            <div className="min-w-0 flex-1 bg-muted rounded-full h-3 overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="shrink-0 text-sm font-bold tabular-nums text-primary">
              {progress}%
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {answeredCount} of {questions.length} questions answered
          </p>
        </div>
      </div>
    </div>
  );
}

// Helper component for adding custom answers
function AddCustomAnswerForm({ onAdd }: { onAdd: (answer: string) => void }) {
  const [customAnswer, setCustomAnswer] = useState('');

  const handleSubmit = () => {
    if (customAnswer.trim()) {
      onAdd(customAnswer);
      setCustomAnswer('');
    }
  };

  return (
    <div className="flex gap-2">
      <Input
        placeholder="Add custom answer..."
        value={customAnswer}
        onChange={e => setCustomAnswer(e.target.value)}
        onKeyPress={e => e.key === 'Enter' && handleSubmit()}
        className="bg-white text-sm"
      />
      <Button
        onClick={handleSubmit}
        size="sm"
        variant="outline"
        className="whitespace-nowrap"
      >
        <Plus className="w-4 h-4" />
      </Button>
    </div>
  );
}
