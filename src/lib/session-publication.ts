/** Use parsed collection data for every session publication decision. */
export function isSessionPublished(session: { data: { draft?: boolean } }): boolean {
  return session.data.draft !== true;
}
