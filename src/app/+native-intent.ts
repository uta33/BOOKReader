export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const url = new URL(path);
    if (url.hostname === 'expo-sharing') return '/handle-share';
  } catch {
    if (path.includes('expo-sharing')) return '/handle-share';
  }
  return path;
}
