import type {
  PhotoCategory,
  PhotoHeroSlide,
  PhotographySettings,
  ProcessStep,
  RateCardGroup,
  SitePhotoItem,
  SiteVideoItem,
  VideoCategory,
} from "./portfolioTypes";

export const UNCATEGORIZED_CATEGORY_ID = "cat-uncategorized";

export const DEFAULT_PHOTO_CATEGORIES: PhotoCategory[] = [
  { id: "cat-wedding", slug: "wedding", label: "Wedding", description: "Ceremony, reception, and couple portraits.", order: 0, visible: true },
  { id: "cat-traditional", slug: "traditional", label: "Traditional / Cultural", description: "Cultural ceremonies and heritage celebrations.", order: 1, visible: true },
  { id: "cat-engagement", slug: "engagement", label: "Engagement & Pre-wedding", order: 2, visible: true },
  { id: "cat-couples", slug: "couples", label: "Couples & Outdoor", order: 3, visible: true },
  { id: "cat-ladies", slug: "ladies", label: "Ladies", order: 4, visible: true },
  { id: "cat-gents", slug: "gents", label: "Gents", order: 5, visible: true },
  { id: "cat-kids", slug: "kids-family", label: "Kids & Family", order: 6, visible: true },
  { id: "cat-maternity", slug: "maternity", label: "Maternity & Newborn", order: 7, visible: true },
  { id: "cat-graduation", slug: "graduation", label: "Graduation", order: 8, visible: true },
  { id: "cat-corporate", slug: "corporate", label: "Corporate & Headshots", order: 9, visible: true },
  { id: "cat-studio", slug: "studio", label: "Studio", order: 10, visible: true },
  { id: "cat-bw", slug: "black-white", label: "Black & White", order: 11, visible: true },
  { id: "cat-fashion", slug: "fashion", label: "Fashion & Editorial", order: 12, visible: true },
  { id: "cat-events", slug: "events", label: "Events", description: "Birthdays, launches, and private events.", order: 13, visible: true },
  { id: "cat-product", slug: "product", label: "Product & Commercial", order: 14, visible: true },
  { id: "cat-lifestyle", slug: "lifestyle", label: "Lifestyle & Outdoor", order: 15, visible: true },
  { id: UNCATEGORIZED_CATEGORY_ID, slug: "uncategorized", label: "Gallery", order: 99, visible: false },
];

export const DEFAULT_VIDEO_CATEGORIES: VideoCategory[] = [
  { id: "vid-wedding", slug: "wedding-films", label: "Wedding films", order: 0, visible: true },
  { id: "vid-events", slug: "event-highlights", label: "Event highlights", order: 1, visible: true },
  { id: "vid-brand", slug: "brand-product", label: "Brand & product", order: 2, visible: true },
  { id: "vid-reels", slug: "reels", label: "Social reels", order: 3, visible: true },
  { id: "vid-corporate", slug: "corporate", label: "Corporate", order: 4, visible: true },
];

export const DEFAULT_PHOTOGRAPHY_SETTINGS: PhotographySettings = {
  whatsappNumber: "254759550133",
  whatsappBookingEnabled: true,
  bookingIntro: "Tell us what you need—we'll reply on WhatsApp with availability and next steps.",
  heroTitle: "Photography & Videography",
  heroSubtitle: "Bold frames, cinematic motion, and delivery built for brands, couples, and creators.",
  globalHeroAnimation: "kenburns",
};

export const DEFAULT_PHOTO_HERO_SLIDES: PhotoHeroSlide[] = [
  {
    id: "hero-1",
    src: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=1920&q=85",
    alt: "Wedding portrait",
    caption: "Weddings & celebrations",
    order: 0,
    animation: "kenburns",
  },
  {
    id: "hero-2",
    src: "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=1920&q=85",
    alt: "Studio portrait",
    caption: "Studio & portraits",
    order: 1,
    animation: "fade",
  },
  {
    id: "hero-3",
    src: "https://images.unsplash.com/photo-1511285560929-80b456fea0d2?w=1920&q=85",
    alt: "Corporate headshot",
    caption: "Corporate & events",
    order: 2,
    animation: "slide",
  },
];

export const DEFAULT_RATE_CARD_GROUPS: RateCardGroup[] = [
  {
    id: "rates-corporate",
    label: "Corporate",
    order: 0,
    packages: [
      { id: "p1", name: "Half-day coverage", price: "KES 35,000", detail: "4 hrs · 80 edited photos · 1 reel", highlight: false },
      { id: "p2", name: "Full-day coverage", price: "KES 65,000", detail: "8 hrs · 150 photos · 2 reels", highlight: true },
      { id: "p3", name: "Monthly retainer", price: "Custom", detail: "Content calendar + studio blocks", highlight: false },
    ],
  },
  {
    id: "rates-weddings",
    label: "Weddings",
    order: 1,
    packages: [
      { id: "p4", name: "Essential", price: "KES 80,000", detail: "Ceremony + portraits · highlight film", highlight: false },
      { id: "p5", name: "Premium", price: "KES 140,000", detail: "Full day photo + video team", highlight: true },
      { id: "p6", name: "Luxury", price: "Custom", detail: "Multi-cam cinema · drone · album design", highlight: false },
    ],
  },
  {
    id: "rates-portraits",
    label: "Portraits & studio",
    order: 2,
    packages: [
      { id: "p7", name: "Individual session", price: "KES 8,000", detail: "1 hr studio · 15 retouched images", highlight: false },
      { id: "p8", name: "Family / group", price: "KES 12,000", detail: "90 min · 25 images", highlight: false },
      { id: "p9", name: "LinkedIn / corporate", price: "KES 6,500", detail: "Headshots · same-day selects", highlight: false },
    ],
  },
  {
    id: "rates-video",
    label: "Videography",
    order: 3,
    packages: [
      { id: "p10", name: "Highlight reel", price: "KES 25,000", detail: "2–3 min film · color grade · music license", highlight: false },
      { id: "p11", name: "Full event film", price: "KES 55,000", detail: "Multi-cam · speeches · cinematic edit", highlight: true },
      { id: "p12", name: "Brand film", price: "Custom", detail: "Script · B-roll · motion graphics", highlight: false },
    ],
  },
];

export const DEFAULT_PROCESS_STEPS: ProcessStep[] = [
  { step: "01", title: "Discovery", text: "Brief, mood board, shot list, and location scouting." },
  { step: "02", title: "Production", text: "On-set direction, lighting, and backup coverage." },
  { step: "03", title: "Post", text: "Color grade, retouch, and client proofing gallery." },
  { step: "04", title: "Delivery", text: "Cloud gallery, social crops, and archival masters." },
];

export const DEFAULT_VIDEO_GALLERY: SiteVideoItem[] = [
  {
    id: "v1",
    title: "Brand film — product launch",
    description: "Short-form brand story with motion graphics and on-location B-roll.",
    embedId: "ysz5S6PUM-U",
    categoryId: "vid-brand",
    featured: true,
    order: 0,
  },
  {
    id: "v2",
    title: "Event highlight reel",
    description: "Fast-paced recap cut for social and website hero loops.",
    embedId: "ysz5S6PUM-U",
    categoryId: "vid-events",
    featured: false,
    order: 1,
  },
];

export function buildDefaultPhotoGallery(): SitePhotoItem[] {
  const items: Omit<SitePhotoItem, "categoryId">[] = [
    { id: "1", src: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800&q=80", alt: "Wedding portrait", tall: true, featured: true, order: 0 },
    { id: "2", src: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80", alt: "Camera gear", tall: false, featured: false, order: 1 },
    { id: "3", src: "https://images.unsplash.com/photo-1478737270239-2fbf6bd88f7f?w=800&q=80", alt: "Live event", tall: false, featured: false, order: 2 },
    { id: "4", src: "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=800&q=80", alt: "Studio portrait", tall: true, featured: true, order: 3 },
    { id: "5", src: "https://images.unsplash.com/photo-1511285560929-80b456fea0d2?w=800&q=80", alt: "Corporate headshot", tall: false, featured: false, order: 4 },
    { id: "6", src: "https://images.unsplash.com/photo-1519741497674-611481863552?w=800&q=80", alt: "Outdoor couple", tall: true, featured: false, order: 5 },
  ];
  const categoryIds = ["cat-wedding", "cat-events", "cat-events", "cat-studio", "cat-corporate", "cat-couples"];
  return items.map((item, i) => ({ ...item, categoryId: categoryIds[i] ?? UNCATEGORIZED_CATEGORY_ID }));
}
