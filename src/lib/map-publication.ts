/** A place is labelled, linked, or given a map panel only after a visit. */
export function isMapLocationPublished(location: { data: { status: string } }): boolean {
  return location.data.status === 'visited';
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
      return {
        ...leg,
        data: {
          ...leg.data,
          route: leg.data.route.filter(slug => visible.has(slug)),
          events: leg.data.events.filter(ev => visible.has(ev.at)),
        },
        segments,
      };
    });
  return { locations, journey };
}
