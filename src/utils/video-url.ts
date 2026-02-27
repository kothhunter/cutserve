/**
 * Build a local-file:// URL from an absolute file path.
 * Handles Windows backslash paths (C:\Users\...) by converting to forward slashes
 * and adding the leading slash expected by the protocol handler.
 */
export function toVideoUrl(filePath: string): string {
  // Convert backslashes to forward slashes (Windows paths)
  let normalized = filePath.replace(/\\/g, '/')
  // Ensure leading slash (Windows drive letters like C:/ need a / prefix in URLs)
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized
  }
  return `local-file://${encodeURI(normalized)}`
}
