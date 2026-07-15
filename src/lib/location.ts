import { isDesktopApp } from './desktop';

export interface LocationFix {
  locationString: string;
  coords: { latitude: number; longitude: number };
  timestamp: number;
}

export type LocationResult = { ok: true; fix: LocationFix } | { ok: false; error: string };

async function reverseGeocode(latitude: number, longitude: number): Promise<string> {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  try {
    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (response.ok) {
      const data = await response.json();
      const parts = [data.city, data.principalSubdivision, data.countryName].filter(Boolean);
      if (parts.length > 0) {
        return `${parts.join(', ')} (${latitude.toFixed(4)}, ${longitude.toFixed(4)}, ${timezone})`;
      }
    }
  } catch {
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)} (${timezone})`;
  }
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)} (${timezone})`;
}

async function requestIpLocation(): Promise<LocationResult> {
  try {
    const response = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return { ok: false, error: 'Location information unavailable' };
    const data = await response.json();
    const latitude = Number(data.latitude);
    const longitude = Number(data.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return { ok: false, error: 'Location information unavailable' };
    }
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const parts = [data.city, data.region, data.country_name].filter(Boolean);
    const locationString =
      parts.length > 0
        ? `${parts.join(', ')} (${latitude.toFixed(4)}, ${longitude.toFixed(4)}, ${timezone})`
        : `${latitude.toFixed(4)}, ${longitude.toFixed(4)} (${timezone})`;
    return { ok: true, fix: { locationString, coords: { latitude, longitude }, timestamp: Date.now() } };
  } catch {
    return { ok: false, error: 'Location information unavailable' };
  }
}

export function requestLocation(): Promise<LocationResult> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    if (isDesktopApp()) return requestIpLocation();
    return Promise.resolve({ ok: false, error: 'Geolocation is not supported here' });
  }

  return new Promise<LocationResult>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const locationString = await reverseGeocode(latitude, longitude);
        resolve({
          ok: true,
          fix: { locationString, coords: { latitude, longitude }, timestamp: position.timestamp },
        });
      },
      (error) => {
        if (isDesktopApp() && error.code !== error.PERMISSION_DENIED) {
          resolve(requestIpLocation());
          return;
        }
        let message = 'Location access denied or unavailable';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Location access denied';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'Location information unavailable';
            break;
          case error.TIMEOUT:
            message = 'Location request timed out';
            break;
        }
        resolve({ ok: false, error: message });
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  });
}

export function locationPromptFragment(enabled: boolean, locationString: string): string {
  if (!enabled || !locationString) return '';
  return `\n\nThe user's approximate location is: ${locationString}. Use it only when relevant.`;
}
