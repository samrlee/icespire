export type RecapScene = { id: string; label: string; body: string };

/** Authored IDs survive edits and insertions; labels are never used as IDs. */
export function sceneMarker(value: string): { id: string; label: string } | undefined {
  if (!value.includes('data-scene-label=')) return;
  const match = value.trim().match(/^<span id="(scene-[a-z][a-z0-9-]*)" data-scene-label="([^"<>&\r\n]+)" class="recap-scene-anchor" tabindex="-1"><\/span>$/);
  if (!match || !match[2].trim()) throw new Error('Invalid recap scene marker');
  return { id: match[1], label: match[2].trim() };
}

export function recapScenes(body: string): RecapScene[] {
  const markers = [...body.matchAll(/^.*data-scene-label=.*$/gm)];
  if (!markers.length) return [];
  if (body.slice(0, markers[0].index).trim()) throw new Error('First recap scene must precede the prose');
  const seen = new Set<string>();
  return markers.map((marker, index) => {
    const scene = sceneMarker(marker[0])!;
    if (seen.has(scene.id)) throw new Error(`Duplicate recap scene: ${scene.id}`);
    seen.add(scene.id);
    return { ...scene, body: body.slice(marker.index! + marker[0].length, markers[index + 1]?.index ?? body.length).trim() };
  });
}
