/**
 * Normalize an image (or any binary we want to send as vision input) to
 * base64. Claude supports jpeg, png, gif, webp — the caller should have
 * already validated the mime type.
 */

export function toBase64(buffer: Buffer): string {
  return buffer.toString("base64");
}
