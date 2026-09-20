import { getCollection, getEntry } from 'astro:content';
import { isSessionPublished } from './session-publication';
import { isMapLocationPublished } from './map-publication';

export async function getCurrentState() {
  const entry = await getEntry('currentState', 'current');
  if (!entry) throw new Error('Current state requires current-state/current.yaml');
  const [sessions, characters, locations] = await Promise.all([
    getCollection('sessions'), getCollection('characters'), getCollection('locations'),
  ]);
  const source = sessions.find(session => session.id === entry.data.sourceSession);
  if (!source || !isSessionPublished(source)) throw new Error('Current state sourceSession must reference a published recap');
  const assigned = new Set<string>();
  const groups = entry.data.groups.map(group => {
    const members = group.characters.map(id => {
      const character = characters.find(character => character.id === id);
      if (!character || assigned.has(id)) throw new Error(`Current state has unknown or repeated character ${id}`);
      assigned.add(id);
      return character;
    });
    const location = locations.find(location => location.id === group.location);
    if (group.location && !location) throw new Error(`Current state has unknown location ${group.location}`);
    return { ...group, members, mapLocation: location && isMapLocationPublished(location) ? location : undefined };
  });
  const latest = sessions.filter(isSessionPublished).sort((a, b) => b.data.sessionNumber - a.data.sessionNumber)[0];
  return { source, groups, newerRecap: latest.data.sessionNumber > source.data.sessionNumber ? latest : undefined };
}
