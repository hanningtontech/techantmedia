export type BadgeTone = "green" | "slate" | "amber" | "blue" | "purple" | "orange";

export interface PortfolioBadge {
  label: string;
  tone: BadgeTone;
}

export interface PortfolioLink {
  label: string;
  href: string;
}

export interface PortfolioProject {
  id: string;
  title: string;
  description: string;
  images: string[];
  badges: PortfolioBadge[];
  links: PortfolioLink[];
  order: number;
}

export type ServiceAccent = "orange" | "teal" | "violet";
export type ServiceIcon = "camera" | "code" | "graduation";

export interface SiteSocialLink {
  label: string;
  href: string;
}

export interface SiteBrand {
  name: string;
  tagline: string;
  heroImage: string;
  logoUrl: string;
  navInitials: string;
  email: string;
  phone: string;
  youtube: string;
  socials: SiteSocialLink[];
}

export interface SiteServiceCard {
  id: string;
  title: string;
  description: string;
  href: string;
  accent: ServiceAccent;
  icon: ServiceIcon;
  order: number;
}

export type HeroAnimation = "fade" | "slide" | "kenburns";

export interface PhotoHeroSlide {
  id: string;
  src: string;
  alt: string;
  caption?: string;
  order: number;
  animation: HeroAnimation;
}

export interface PhotoCategory {
  id: string;
  slug: string;
  label: string;
  description?: string;
  order: number;
  visible: boolean;
}

export interface SitePhotoItem {
  id: string;
  src: string;
  alt: string;
  categoryId: string;
  tall: boolean;
  featured: boolean;
  order: number;
}

export interface VideoCategory {
  id: string;
  slug: string;
  label: string;
  order: number;
  visible: boolean;
}

export interface SiteVideoItem {
  id: string;
  title: string;
  description: string;
  embedId: string;
  categoryId: string;
  featured: boolean;
  order: number;
}

export interface RateCardPackage {
  id: string;
  name: string;
  price: string;
  detail: string;
  highlight: boolean;
}

export interface RateCardGroup {
  id: string;
  label: string;
  order: number;
  packages: RateCardPackage[];
}

export interface ProcessStep {
  step: string;
  title: string;
  text: string;
}

export interface PhotographySettings {
  whatsappNumber: string;
  whatsappBookingEnabled: boolean;
  bookingIntro: string;
  heroTitle: string;
  heroSubtitle: string;
  globalHeroAnimation: HeroAnimation;
}

/** CMS document for TechantMedia storefront (`portfolio/site`). */
export interface SiteContent {
  brand: SiteBrand;
  serviceCards: SiteServiceCard[];
  featuredProjects: PortfolioProject[];
  devSkills: string[];
  photoGallery: SitePhotoItem[];
  photoHeroSlides: PhotoHeroSlide[];
  photoCategories: PhotoCategory[];
  videoGallery: SiteVideoItem[];
  videoCategories: VideoCategory[];
  rateCardGroups: RateCardGroup[];
  processSteps: ProcessStep[];
  photographySettings: PhotographySettings;
}

/** Legacy `/portfolio` page shape (built from SiteContent + static sections). */
export type ExpertiseColor = "orange" | "blue" | "green";

export interface PortfolioExpertiseCard {
  id: string;
  title: string;
  color: ExpertiseColor;
  items: string[];
  order: number;
}

export interface PortfolioNextProject {
  id: string;
  title: string;
  description: string;
  badges: PortfolioBadge[];
  order: number;
}

export interface PortfolioExperienceItem {
  id: string;
  title: string;
  subtitle: string;
  period: string;
  bullets: string[];
  accentColor: "orange" | "blue";
  order: number;
}

export interface PortfolioEducationItem {
  id: string;
  title: string;
  description: string;
  bullets: string[];
  variant: "slate" | "orange";
  order: number;
}

export interface PortfolioSiteContent {
  profile: {
    navInitials: string;
    name: string;
    tagline: string;
    subtitle: string;
    imageUrl: string;
  };
  about: { paragraphs: string[] };
  expertise: PortfolioExpertiseCard[];
  featuredProjects: PortfolioProject[];
  nextProjects: PortfolioNextProject[];
  process: { intro: string; heading: string; items: string[] };
  experience: { intro: string; items: PortfolioExperienceItem[] };
  education: { intro: string; items: PortfolioEducationItem[] };
  contact: {
    heading: string;
    intro: string;
    email: string;
    phone: string;
    githubLabel: string;
    githubUrl: string;
  };
  footer: { copyright: string; tagline: string };
}
