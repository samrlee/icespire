interface Character { id: string; data: { player: string } }
interface Session { data: { playersPresent: string[]; charactersPresent?: string[] } }

/** Cast selection is not evidence of a character's presence at every scene or knowledge. */
export function resolveSessionParty<C extends Character>(session: Session, roster: C[]) {
  const errors: string[] = [];
  const selected = new Set<string>();
  if (session.data.charactersPresent !== undefined) {
    for (const id of session.data.charactersPresent) {
      if (!roster.some(character => character.id === id)) errors.push(`charactersPresent references missing character ${JSON.stringify(id)}`);
      if (selected.has(id)) errors.push(`charactersPresent repeats character ${JSON.stringify(id)}`);
      selected.add(id);
    }
  } else {
    for (const player of new Set(session.data.playersPresent)) {
      const candidates = roster.filter(character => character.data.player === player);
      if (candidates.length > 1) {
        errors.push(`playersPresent is ambiguous for ${JSON.stringify(player)}; set charactersPresent explicitly`);
      } else if (candidates.length === 1) selected.add(candidates[0].id);
      // Unknown attendance names are reported by the shared reference validator.
    }
  }
  return { party: roster.filter(character => selected.has(character.id)), errors };
}
