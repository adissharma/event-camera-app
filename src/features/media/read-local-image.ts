import { Platform } from 'react-native';
import { File } from 'expo-file-system';

/**
 * Reads a locally captured or picked image into raw bytes for upload.
 *
 * `expo-file-system`'s `File` class is a native-only bridge. On web it is a
 * no-op stub — its constructor only logs a warning, and it defines no other
 * members at all — so `new File(uri).arrayBuffer()` throws `TypeError:
 * file.arrayBuffer is not a function` on every web capture or camera-roll
 * pick, and `file.size` is always `undefined`. That is why no photo a web
 * guest or host took ever finished uploading: the failure happened inside
 * this byte-read step, after the upload intent had already been reserved.
 *
 * The browser's own `fetch` reads any URI scheme this app produces on web —
 * a `data:` URI from `expo-camera`'s web capture, or a `blob:` URI from
 * `expo-image-picker`'s web picker — with no filesystem bridge required, so
 * web uses that instead. Native keeps the `expo-file-system` bridge, which
 * is what a real `file://` URI needs.
 */
export async function readLocalImageBytes(
  uri: string,
): Promise<{ bytes: ArrayBuffer; sizeBytes: number | null }> {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const bytes = await response.arrayBuffer();
    return { bytes, sizeBytes: bytes.byteLength };
  }
  const file = new File(uri);
  const bytes = await file.arrayBuffer();
  return { bytes, sizeBytes: file.size ?? bytes.byteLength };
}
