/**
 * Browser geolocation, native-only. Resolves the user's approximate position
 * with `navigator.geolocation` and formats it — coordinates plus the resolved
 * timezone — into a string that can be injected into the system prompt. No
 * third-party geocoding services are contacted.
 */

export interface LocationFix {
  locationString: string;
  coords: { latitude: number; longitude: number };
  timestamp: number;
}

export type LocationResult = { ok: true; fix: LocationFix } | { ok: false; error: string };

function formatLocationString(latitude: number, longitude: number): string {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)} (${timezone})`;
}

/**
 * Requests geolocation permission and resolves the current position. Never
 * rejects — failures resolve to `{ ok: false, error }`.
 */
export function requestLocation(): Promise<LocationResult> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve({ ok: false, error: 'Geolocation is not supported here' });
  }

  return new Promise<LocationResult>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        resolve({
          ok: true,
          fix: {
            locationString: formatLocationString(latitude, longitude),
            coords: { latitude, longitude },
            timestamp: position.timestamp,
          },
        });
      },
      (error) => {
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

/** The prompt fragment for a resolved location, or `''` when disabled/unknown. */
export function locationPromptFragment(enabled: boolean, locationString: string): string {
  if (!enabled || !locationString) return '';
  return `\n\nThe user's approximate location is: ${locationString}. Use it only when relevant.`;
}
