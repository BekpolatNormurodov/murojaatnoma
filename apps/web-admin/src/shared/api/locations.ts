import { api } from './client';

export interface LiveLocation {
  employeeId: string;
  fullName: string;
  position: string;
  avatarUrl: string | null;
  district: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  mahallaCode: string | null;
  mahallaName: string | null;
  insideDistrict: boolean;
  insideOffice: boolean;
  lastLocationAt: string | null;
  ageMinutes: number | null;
  hasLocation: boolean;
  isStale: boolean;
}

export interface LocationStats {
  totalActive: number;
  reportingNow: number;
  insideOffice: number;
  stale: number;
  staleMinutes: number;
}

export interface TrackPoint {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  insideOffice: boolean;
  insideDistrict: boolean;
  mahallaName: string | null;
  recordedAt: string;
}

export interface TrackResult {
  employee: { id: string; fullName: string; position: string };
  count: number;
  points: TrackPoint[];
}

export interface LocationAlert {
  employeeId: string;
  fullName: string;
  position: string;
  phone: string;
  avatarUrl: string | null;
  lastLocationAt: string | null;
  lastMahallaName: string | null;
  reason: 'stale' | 'never';
  ageMinutes: number | null;
  alerted: boolean;
}

export const fetchLiveLocations = () => api.get<LiveLocation[]>('/locations/latest');
export const fetchLocationStats = () => api.get<LocationStats>('/locations/stats');
export const fetchLocationAlerts = () => api.get<LocationAlert[]>('/locations/alerts');

export function fetchTrack(
  employeeId: string,
  params?: { from?: string; to?: string; limit?: number },
): Promise<TrackResult> {
  const q = new URLSearchParams();
  if (params?.from) q.set('from', params.from);
  if (params?.to) q.set('to', params.to);
  if (params?.limit) q.set('limit', String(params.limit));
  const qs = q.toString();
  return api.get<TrackResult>(`/locations/${employeeId}/track${qs ? `?${qs}` : ''}`);
}
