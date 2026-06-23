export const DEFAULT_SHOW_FOLDER_EMOJI = true;
export const PARENT_MARKER_PREFIX = "📁 ";

const LEGACY_PARENT_MARKER_PREFIX = "★ ";

export function buildFolderDisplayText(
  text: string,
  options: {
    showFolderEmoji: boolean;
  }
): string {
  const baseText = stripParentMarkerPrefix(text);

  return options.showFolderEmoji ? `${PARENT_MARKER_PREFIX}${baseText}` : baseText;
}

function stripParentMarkerPrefix(text: string): string {
  if (text.startsWith(PARENT_MARKER_PREFIX)) {
    return text.slice(PARENT_MARKER_PREFIX.length);
  }

  return text.startsWith(LEGACY_PARENT_MARKER_PREFIX)
    ? text.slice(LEGACY_PARENT_MARKER_PREFIX.length)
    : text;
}
