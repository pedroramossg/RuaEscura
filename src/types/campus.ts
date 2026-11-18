export type Coordinates = [number, number];

export type LampPostStatus = 'aceso' | 'oscilando' | 'queimado';

export interface LampPost {
  id: string;
  name: string;
  coordinates: Coordinates;
  status: LampPostStatus;
  connectedEdgeIds: string[];
  lastUpdated: string;
}

export type CampusNodeCategory = 'centro' | 'servico' | 'entorno' | 'lazer';

export interface CampusNode {
  id: string;
  name: string;
  shortName: string;
  coordinates: Coordinates;
  category: CampusNodeCategory;
  description?: string;
}

export interface CampusEdge {
  id: string;
  from: string;
  to: string;
  distance: number; // in meters
  baseIllumination: number; // 0 to 100 percentage
  lampPostIds: string[];
  waypoints?: Coordinates[];
}

export interface EdgeRatingSummary {
  averageRating: number; // 1.0 to 5.0
  count: number;
}

export type ReportCategory = 'iluminacao' | 'assedio' | 'suspeito' | 'manutencao' | 'outro';

export type ReportStatus = 'pendente' | 'em_analise' | 'resolvido';

export interface IncidentReport {
  id: string;
  category: ReportCategory;
  locationName: string;
  locationNodeId?: string;
  description: string;
  isConfidential: boolean;
  createdAt: string;
  status: ReportStatus;
  photoThumbnailUrl?: string;
}

export type RouteMode = 'brightest' | 'fastest';

export interface RouteResult {
  path: string[];
  coordinates: Coordinates[];
  distanceMeters: number;
  estimatedMinutes: number;
  illuminationPercentage: number;
  hasDarkWarning: boolean;
  edges: CampusEdge[];
  posts: LampPost[];
}

export interface CompanionMatch {
  id: string;
  name: string;
  initials: string;
  ufscAffiliation: string;
  isGovBrVerified: boolean;
  originId: string;
  destinationId: string;
  departureTime: string;
  currentStatus: 'aguardando' | 'a_caminho' | 'concluido';
  isUserJoined?: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  isSystem?: boolean;
}

export interface GovBrSession {
  name: string;
  cpfMasked: string;
  affiliation: string;
  verifiedAt: string;
}

export interface PersistedCampusState {
  version: number;
  onboardingCompleted: boolean;
  selectedBuildings: string[];
  timeSlot: string;
  isNightMap: boolean;
  hapticsEnabled: boolean;
  userSession: GovBrSession | null;
  posts: LampPost[];
  edgeRatings: Record<string, EdgeRatingSummary>;
  reports: IncidentReport[];
  companionMatches: CompanionMatch[];
  chatMessages: Record<string, ChatMessage[]>;
  activeOriginId: string;
  activeDestinationId: string;
  routeMode: RouteMode;
  scheduledDeparture?: {
    time: string;
    updatedAt: string;
  };
}
