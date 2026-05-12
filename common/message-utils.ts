/**
 * Checks if a Rocket.Chat message payload represents a system/metadata message
 * (like user joined, user left, room changed, etc.) rather than a real user message.
 */
export function isSystemMessage(payload: any): boolean {
  // Rocket.Chat uses the 't' field for system message types
  return !!payload.t;
}

/**
 * Checks if a message is a "real" message that should be processed for embeddings.
 */
export function isRealMessage(payload: any): boolean {
  return !isSystemMessage(payload) && !!(payload.msg ?? "").trim();
}
