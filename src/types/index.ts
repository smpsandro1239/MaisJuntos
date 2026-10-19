export type UserRole = 'parent' | 'curator' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: UserRole;
  provider: 'google' | 'github' | 'guest';
  emailVerified?: boolean;
  trustScore?: number;
  familyProfile?: {
    children: Array<{ name: string; age: number; id: string }>;
    city: string;
    favorites: string[];
    maxBudget?: number;
    strollerNeeded?: boolean;
  };
}

export interface Amenity {
  id: string;
  label: string;
  description: string;
  icon: string;
  verified: boolean;
}

export interface OpeningHour {
  day: string;
  status: 'open' | 'special' | 'closed';
  label: string;
  open?: string;
  close?: string;
  lunchBreak?: string;
}

export interface POI {
  id: string;
  code: string; // e.g. #POI-2024-BRG-881
  name: string;
  slug: string;
  category: string;
  categoryLabel: string;
  categoryIcon: string;
  shortDescription: string;
  fullDescription: string;
  rating: number;
  reviewCount: number;
  images: string[];
  coverImage: string;
  ticketProofImage?: string;
  distanceMinutes: number;
  distanceKm: number;
  city: string;
  address: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  minAge: number;
  maxAge: number;
  ageRecommendation: string;
  isFree: boolean;
  priceChild: number;
  priceAdult: number;
  priceFamily: number;
  priceNotes: string;
  spaceType: 'interior' | 'exterior' | 'mixed';
  isOpenNow: boolean;
  openingHoursToday: string;
  schedule: OpeningHour[];
  amenities: Amenity[];
  experienceHighlights: Array<{ number: number; title: string; description: string }>;
  verifiedAgoDays: number;
  verifiedSource: string;
  verifiedBy: string;
  dataQualityScore: number; // 0 - 100
  status: 'verified' | 'pending' | 'review' | 'draft';
  hasActiveReport?: boolean;
  reportsCount?: number;
  bookingPolicy: 'none' | 'recommended_weekend' | 'required';
  bookingUrl?: string;
  phone: string;
  phoneTested: boolean;
  lastPhysicalAudit: string;
  holidayAlert?: string;
  createdAt: string;
  updatedAt: string;
}

export type ReportIssueType =
  | 'price_changed'
  | 'nursery_closed'
  | 'schedule_wrong'
  | 'temporary_closure'
  | 'accessibility'
  | 'parking'
  | 'confirm_ok'
  | 'new_place';

// Proposta de novo espaço submetida pela comunidade (issueType === 'new_place').
export interface ProposedPlace {
  name: string;
  category: string;
  address: string;
  city: string;
  latitude?: number;
  longitude?: number;
  /** Ligação de mapa colada pelo utilizador (Google Maps/OpenStreetMap). */
  locationLink?: string;
  minAge?: number;
  maxAge?: number;
  isFree?: boolean;
  priceFamily?: number;
  spaceType?: 'interior' | 'exterior' | 'mixed';
  hasNursery?: boolean;
  hasStrollerAccess?: boolean;
  hasParking?: boolean;
  isOpenNow?: boolean;
  scheduleNote?: string;
}

export interface CommunityReport {
  id: string;
  code: string; // e.g. #REP-4091
  poiId: string;
  poiName: string;
  poiAddress: string;
  issueType: ReportIssueType;
  issueLabel: string;
  severity: 'critical' | 'warning' | 'info';
  status: 'open' | 'in_review' | 'resolved' | 'dismissed';
  reportedAgo: string;
  reporterName: string;
  reporterSubtitle: string;
  reporterTrust: number; // e.g. 98%
  badgeLevel?: string;
  comment: string;
  oldValue: string;
  newValue: string;
  deltaPercent?: string;
  hasPhotoProof: boolean;
  photoUrl?: string;
  poiPhone: string;
  gpsDistanceProofMeters: number;
  checklist: Array<{ id: string; label: string; checked: boolean }>;
  proposedPlace?: ProposedPlace;
  createdAt: string;
}

export interface FamilyPlanActivity {
  id: string;
  time: string;
  periodLabel: string;
  durationOrWalk: string;
  title: string;
  description: string;
  image?: string;
  badge: string;
  costEstimate: number;
  costLabel: string;
  icon: string;
  tags?: string[];
  poiId?: string;
}

export interface FamilyPlan {
  id: string;
  title: string;
  subtitle: string;
  isOptimized: boolean;
  city: string;
  dateLabel: string;
  weatherCondition: string;
  weatherTemp: string;
  budgetMax: number;
  budgetCalculated: number;
  budgetSavings: number;
  budgetPercentage: number;
  drivingMinutesTotal: number;
  walkingMaxMinutes: number;
  parkingInfo: string;
  parkingSpotsAvailable: number;
  isPlanBActive: boolean;
  activities: FamilyPlanActivity[];
  planBActivity: FamilyPlanActivity;
  parentTip: string;
  children: Array<{ name: string; age: number }>;
}

export interface OperationalMetrics {
  totalPois: number;
  validatedThisWeek: number;
  pendingValidation: number;
  averageDataQuality: number;
  qualityDiffPercent: number;
  expiringAuditCount: number;
  criticalReportsCount: number;
  activeCommunityCount: number;
  resolutionTimeHours: number;
  communityAccuracyPercent: number;
  ambassadorsCount: number;
  categoryDistribution: Array<{
    category: string;
    label: string;
    count: number;
    percentage: number;
    color: string;
  }>;
  territorialCoverage: Array<{
    initial: string;
    concelho: string;
    sublabel: string;
    poisAudited: number;
    verificationRate: number;
    confidenceScore: number;
    confidenceLabel: string;
  }>;
  recentEditorialActions: Array<{
    id: string;
    author: string;
    poiName: string;
    timeAgo: string;
    badge: string;
    color: string;
  }>;
}

export type WsMessage =
  | { type: 'init'; data: { pois: POI[]; reports: CommunityReport[]; metrics: OperationalMetrics; connectedUsers: number } }
  | { type: 'presence'; data: { connectedUsers: number } }
  | { type: 'poi:update'; data: POI }
  | { type: 'poi:create'; data: POI }
  | { type: 'poi:delete'; data: { id: string } }
  | { type: 'report:create'; data: CommunityReport }
  | { type: 'report:update'; data: CommunityReport }
  | { type: 'plan:update'; data: FamilyPlan }
  | { type: 'notification'; data: { title: string; message: string; timestamp: string } };
