/** What a mobile app says about the phone it signs in from. All optional. */
export interface ClientInfo {
  device?: string;
  platform?: string;
  appVersion?: string;
}

/** Header values are client input: trimmed, decoded and length-capped. */
export function clientInfo(headers: Record<string, unknown>): ClientInfo {
  const read = (name: string, max: number): string | undefined => {
    const raw = headers[name];
    if (typeof raw !== 'string') return undefined;
    let value = raw;
    try {
      value = decodeURIComponent(raw);
    } catch {
      // Not percent-encoded — keep as sent.
    }
    // Control characters have no place in a device name.
    value = value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
    return value || undefined;
  };
  const info: ClientInfo = {
    device: read('x-app-device', 120),
    platform: read('x-app-platform', 20),
    appVersion: read('x-app-version', 40),
  };
  return Object.fromEntries(Object.entries(info).filter(([, v]) => v !== undefined));
}
