const DEFAULT_SHOW_FOLDER_EMOJI = true;
const PARENT_MARKER_PREFIX = "📁 ";
const LEGACY_PARENT_MARKER_PREFIX = "★ ";
function buildFolderDisplayText(text, options) {
  const baseText = stripParentMarkerPrefix(text);
  return options.showFolderEmoji ? `${PARENT_MARKER_PREFIX}${baseText}` : baseText;
}
function stripParentMarkerPrefix(text) {
  if (text.startsWith(PARENT_MARKER_PREFIX)) {
    return text.slice(PARENT_MARKER_PREFIX.length);
  }
  return text.startsWith(LEGACY_PARENT_MARKER_PREFIX) ? text.slice(LEGACY_PARENT_MARKER_PREFIX.length) : text;
}
export {
  DEFAULT_SHOW_FOLDER_EMOJI,
  PARENT_MARKER_PREFIX,
  buildFolderDisplayText
};
