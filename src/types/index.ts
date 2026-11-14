export type UserRole = 'user' | 'admin';
export type UserPlan = 'free' | 'pro' | 'admin_unlimited';
export type UserStatus = 'active' | 'suspended';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: UserRole;
  plan: UserPlan;
  apiKey: string;
  dailyLimit: number;
  monthlyLimit?: number;
  requestsThisMonth?: number;
  usageMonth?: string;
  packageId?: string;
  packageName?: string;
  requestsToday: number;
  requestsTotal: number;
  status: UserStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
  lastLoginAt?: unknown;
}

export type ComicType = 'Manga' | 'Manhwa' | 'Manhua';
export type ComicStatus = 'Ongoing' | 'Completed' | 'Hiatus';

export interface ComicSummary {
  id: number;
  rank?: number;
  slug: string;
  title: string;
  alternative_title: string;
  type: ComicType;
  country: 'JP' | 'KR' | 'CN';
  language: 'id';
  status: ComicStatus;
  rating: number;
  rating_source?: string;
  age_rating?: string;
  views: number;
  views_label?: string;
  chapter_count: number;
  latest_chapter: string;
  latest_chapter_number: number;
  latest_chapter_slug: string;
  released_at: string;
  updated_at: string;
  updated_label: string;
  cover_url: string;
  proxy_cover_url: string;
  author: string;
  artist: string;
  genres: string[];
  source: string;
  komiku_url: string;
}

export interface ChapterSummary {
  chapter_id: number;
  chapter_slug: string;
  chapter_number: number;
  title: string;
  released_label: string;
  released_at: string;
}

export interface ComicDetail extends ComicSummary {
  synopsis: string;
  theme?: string;
  reading_direction?: string;
  added_at: string;
  chapters: ChapterSummary[];
}

export interface ChapterPage {
  page: number;
  image_url: string;
  proxy_image_url: string;
}

export interface ChapterDetail {
  chapter_slug: string;
  chapter_id: number;
  comic_id: number;
  comic_slug: string;
  comic_title: string;
  chapter_number: number;
  chapter_title: string;
  released_label: string;
  released_at: string;
  prev_chapter_slug: string | null;
  next_chapter_slug: string | null;
  total_pages: number;
  source: string;
  pages: ChapterPage[];
}

export interface KomikuFilters {
  genres: string[];
  types: string[];
  statuses: string[];
}

export interface CatalogPagination {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
}

export interface CacheStats {
  entries: number;
  maxEntries: number;
  hits: number;
  misses: number;
  staleServes: number;
  coalescedSaves: number;
  hitRatePercent: number;
  avgResponseMs: number;
  lastFlushAt: string | null;
}

export interface PublicStats {
  total_titles: number;
  total_pages?: number;
  total_requests: number;
  requests_today: number;
  api_v1_requests: number;
  cache: CacheStats;
}

export interface ApiAccessLog {
  id: string;
  timestamp: string;
  method: string;
  endpoint: string;
  statusCode: number;
  cacheStatus: string;
  userAgent: string;
  apiKeyPrefix: string;
  role: string;
  latencyMs: number;
}

export interface ServerKeyUsage {
  apiKey: string;
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  plan: UserPlan;
  dailyLimit: number;
  monthlyLimit?: number;
  requestsThisMonth?: number;
  usageMonth?: string;
  packageId?: string;
  packageName?: string;
  requestsToday: number;
  requestsTotal: number;
  usageDate: string;
  status: UserStatus;
  lastUsedAt: string | null;
  lastUserAgent: string | null;
}

export interface PricingPackage {
  id: string;
  name: string;
  tagline: string;
  tokensPerMonth: number;
  priceIdr: number;
  billingPeriodLabel: string;
  features: string[];
  highlighted: boolean;
  active: boolean;
  ctaLabel: string;
}

export interface SiteSettings {
  freeDailyTokens: number;
  freePlanName: string;
  freePlanDescription: string;
  ownerWhatsappNumber: string;
  ownerWhatsappName: string;
  whatsappMessageTemplate: string;
  pricingHeadline: string;
  pricingSubtitle: string;
  billingNotice: string;
  packages: PricingPackage[];
  updatedAt: string;
}
