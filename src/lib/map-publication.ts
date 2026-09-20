/** A place is labelled, linked, or given a map panel only after a visit. */
export function isMapLocationPublished(location: { data: { status: string } }): boolean {
  return location.data.status === 'visited';
}

/** Interior geometry and legend entries share this gate. */
export function isMapInteriorPublished(location: {
  data: { status: string; interiorSeen?: boolean };
}): boolean {
  return isMapLocationPublished(location) && location.data.interiorSeen === true;
}

/** A registered exterior can publish before its interior; an interior-only map cannot. */
export function isLocalMapPublished(
  location: { data: { status: string; interiorSeen?: boolean } },
  entry: { interiorOnly?: boolean } | undefined,
): boolean {
  return !!entry && isMapLocationPublished(location)
    && (!entry.interiorOnly || isMapInteriorPublished(location));
}

/** Gate authored map destinations (e.g. encounter cards); other links pass through. */
export function isMapLinkPublished(
  href: string,
  locations: { id: string; data: { status: string; interiorSeen?: boolean } }[],
  submaps: Record<string, { interiorOnly?: boolean }>,
): boolean {
  const target = new URL(href, 'https://icespire.ghostbloods.net');
  if (target.pathname !== '/map' && !target.pathname.startsWith('/map/')) return true;
  try {
    const localId = decodeURIComponent(target.pathname.replace(/^\/map\/?/, '').replace(/\/$/, ''));
    const id = localId || decodeURIComponent(target.hash.slice(1));
    if (!id) return true; // The region map itself is always available.
    const location = locations.find(loc => loc.id === id);
    return !!location && (localId
      ? isLocalMapPublished(location, submaps[localId])
      : isMapLocationPublished(location));
  } catch {
    return false; // An invalid encoded destination cannot resolve to a marker.
  }
}

interface Location { id: string; data: { status: string } }
interface Journey { data: { session: number; route: string[]; events: { at: string }[] } }

/** Filter before rendering: hidden stops must not leak through replay or pins. */
export function publishedMapData<L extends Location, J extends Journey>(
  allLocations: L[],
  allJourney: J[],
  publishedSessions: ReadonlySet<number>,
) {
  const locations = allLocations.filter(isMapLocationPublished);
  const visible = new Set(locations.map(loc => loc.id));
  const existing = new Set(allLocations.map(loc => loc.id));
  const journey = allJourney
    .filter(leg => publishedSessions.has(leg.data.session))
    .map(leg => {
      for (const slug of [...leg.data.route, ...leg.data.events.map(ev => ev.at)]) {
        if (!existing.has(slug)) {
          throw new Error(`Map: unknown location slug "${slug}" in journey session ${leg.data.session}`);
        }
      }
      // Keep original adjacency: A → hidden → B must not become an A → B arc.
      const segments = leg.data.route.slice(1).flatMap((to, i) => {
        const from = leg.data.route[i];
        return visible.has(from) && visible.has(to) ? [[from, to] as const] : [];
      });
      // A separate adjacency flag keeps text/replay from implying a shortcut,
      // without serializing the identity of the intervening hidden waypoint.
      const stops = leg.data.route.flatMap((slug, i) => visible.has(slug)
        ? [{ slug, connected: i > 0 && visible.has(leg.data.route[i - 1]) }]
        : []);
      return {
        ...leg,
        data: {
          ...leg.data,
          route: leg.data.route.filter(slug => visible.has(slug)),
          events: leg.data.events.filter(ev => visible.has(ev.at)),
        },
        segments,
        stops,
      };
    });
  return { locations, journey };
}
