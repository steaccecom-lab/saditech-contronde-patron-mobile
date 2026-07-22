import { Linking } from 'react-native';

export function extractRoundId(url: string | null): string | null {
  if (!url) {
    return null;
  }

  const match = url.match(/^controndepatron:\/\/rounds\/([^/?#]+)/);
  return match?.[1] ?? null;
}

export async function getInitialRoundId(): Promise<string | null> {
  return extractRoundId(await Linking.getInitialURL());
}
