/** Static page content not in CMS — edit in code or extend admin later. */

export const VIDEO_SHOWCASE = [
  {
    id: "v1",
    title: "Brand film — product launch",
    embedId: "dQw4w9WgXcQ",
    description: "Short-form brand story with motion graphics and on-location B-roll.",
  },
  {
    id: "v2",
    title: "Event highlight reel",
    embedId: "ysz5S6PUM-U",
    description: "Fast-paced recap cut for social and website hero loops.",
  },
] as const;

export const RATE_CARDS = {
  corporate: [
    { name: "Half-day coverage", price: "KES 35,000", detail: "4 hrs · 80 edited photos · 1 reel" },
    { name: "Full-day coverage", price: "KES 65,000", detail: "8 hrs · 150 photos · 2 reels" },
    { name: "Monthly retainer", price: "Custom", detail: "Content calendar + studio blocks" },
  ],
  weddings: [
    { name: "Essential", price: "KES 80,000", detail: "Ceremony + portraits · highlight film" },
    { name: "Premium", price: "KES 140,000", detail: "Full day photo + video team" },
    { name: "Luxury", price: "Custom", detail: "Multi-cam cinema · drone · album design" },
  ],
  portraits: [
    { name: "Individual session", price: "KES 8,000", detail: "1 hr studio · 15 retouched images" },
    { name: "Family / group", price: "KES 12,000", detail: "90 min · 25 images" },
    { name: "LinkedIn / corporate", price: "KES 6,500", detail: "Headshots · same-day selects" },
  ],
} as const;

export const PHOTO_PROCESS = [
  { step: "01", title: "Discovery", text: "Brief, mood board, shot list, and location scouting." },
  { step: "02", title: "Production", text: "On-set direction, lighting, and backup coverage." },
  { step: "03", title: "Post", text: "Color grade, retouch, and client proofing gallery." },
  { step: "04", title: "Delivery", text: "Cloud gallery, social crops, and archival masters." },
] as const;

export const TUTORING_TOPICS = [
  "Safe & Effective Care Environment",
  "Health Promotion",
  "Psychosocial Integrity",
  "Physiological Adaptation",
  "Pharmacology & Dosage Calc",
  "Prioritization & Delegation",
] as const;

export const TUTORING_SCHEDULE = [
  { day: "Mon / Wed", time: "6:00 PM – 8:00 PM EAT", format: "Live review + Q&A" },
  { day: "Saturday", time: "10:00 AM – 1:00 PM EAT", format: "CAT-style practice blocks" },
  { day: "Async", time: "Weekly", format: "Assigned quizzes + rationales in the app" },
] as const;

export const CONTACT_SERVICES = ["Photography", "Development", "Tutoring"] as const;
