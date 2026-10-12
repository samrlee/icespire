import type { BriefingItem, EvidenceClaim, SceneCitation } from '../lib/provenance';

/** Curated facts require an editorial update; references are validated, not inferred. */
export const referenceReview = 'session-9';
const party = ['barnaby', 'bean-hootwhistle', 'dax', 'hamish', 'rut', 'sage', 'thom'] as const;
const templeChamber: SceneCitation = { sessionId: 'session-7', sceneId: 'scene-s5100d73fb7' };
const negotiation: SceneCitation = { sessionId: 'session-8', sceneId: 'scene-s2aa70599ef' };
const weasel: SceneCitation = { sessionId: 'session-8', sceneId: 'scene-s86eb54229a' };
const declaration: SceneCitation = { sessionId: 'session-8', sceneId: 'scene-sb893d2e8ff' };
const deskSearch: SceneCitation = { sessionId: 'session-8', sceneId: 'scene-s4fb47213c9' };
const account: SceneCitation = { sessionId: 'session-9', sceneId: 'scene-s326fe50dfd' };
const sharedAccount = { citation: account, recipients: party, note: 'The whole party heard the returned companions’ account at the inn.' };

export const evidenceClaims: readonly EvidenceClaim[] = [
  {
    id: 'temple-explosion', topic: 'temple', title: 'The statue explosion', basis: 'observed',
    statement: 'Thom lifted the emerald with Mage Hand. The standing statue burst; Rut and Barnaby were injured, and the emerald survived.',
    witnesses: ['rut', 'thom', 'bean-hootwhistle', 'barnaby'],
    witnessNote: 'These four were inside when the statue burst. Dax and Hamish entered afterward. Sage stayed outside and treated Rut after he crawled out.',
    citations: [templeChamber],
    tellings: [{ citation: templeChamber, recipients: ['dax', 'hamish'], note: 'Thom explained the chamber and explosion after Dax and Hamish entered.' }],
    limits: 'The matching debris does not establish how or when the other statue broke. No second gem was witnessed.',
  },
  {
    id: 'temple-ledger', topic: 'temple', title: 'What the ledger describes', basis: 'reported',
    statement: 'The ledger describes a dark sacrifice chamber flanked by two statues. The round chamber opened later has not been confirmed as that room.',
    witnesses: ['sage'], witnessNote: 'Sage read the ledger privately. A complete briefing of the party is not recorded.',
    citations: [{ sessionId: 'session-6', sceneId: 'scene-s340036aba3' }, templeChamber], tellings: [],
    limits: 'A matching description is not an identification. The ledger does not explain where the wealth went.',
  },
  {
    id: 'temple-offering-note', topic: 'temple', title: 'The offering note', basis: 'reported',
    statement: 'The note is in Common. It orders offerings to Abbathor to cease and permits survivors to take what remains.',
    witnesses: ['thom'], witnessNote: 'Thom showed the note around and treated it as permission to take the offering. The individual recipients are not listed.',
    citations: [templeChamber], tellings: [],
    limits: 'The note’s author, date and choice of language are unknown. It does not establish a divine blessing or freedom from consequences.',
  },
  {
    id: 'temple-earlier-statue', topic: 'temple', title: 'The earlier broken statue', basis: 'observed',
    statement: 'The other statue was already in pieces when the chamber was opened. After the explosion, the fresh debris lay in the same pattern.',
    witnesses: null, witnessNote: 'Individual witnesses to the comparison were not separately recorded.',
    citations: [templeChamber], tellings: [],
    limits: 'The cause, timing and participants in the earlier destruction are not recorded; no earlier gem was recovered or seen in place.',
  },
  {
    id: 'exchange-payment', topic: 'exchange', title: 'Dax’s fifty gold', basis: 'observed',
    statement: 'Thornton paid Dax fifty gold for the orc intelligence. He later disclosed it and shared it at seven gold each.',
    witnesses: ['dax', 'rut'], witnessNote: 'Dax negotiated. Rut heard the entire negotiation from under the door.',
    citations: [negotiation, weasel],
    tellings: [{ citation: account, recipients: party, note: 'Dax described the negotiation and put the fifty gold on the table for the party.' }],
    limits: 'The fifty gold is separate from Dax’s original trade commission. The ledger line has no identified amount or job. Later sharing does not add witnesses to the original meeting.',
  },
  {
    id: 'exchange-townmaster', topic: 'exchange', title: 'Thornton’s stated intention', basis: 'observed',
    statement: 'Thornton said she intended to replace Harbin as townmaster. Thom and Bean later told the party.',
    witnesses: ['thom', 'bean-hootwhistle'], witnessNote: 'Only Thom and Bean heard the declaration in the office after Dax left. Rut did not hear this speech.',
    citations: [declaration], tellings: [sharedAccount],
    limits: 'A declaration of intent is not a completed takeover. How the adventurers’ information would secure the office remains unclear.',
  },
  {
    id: 'exchange-kill-order', topic: 'exchange', title: 'The conditional kill order', basis: 'observed',
    statement: 'Thornton ordered her guards to set the entire troop on the party if they were caught snooping again.',
    witnesses: ['thom', 'bean-hootwhistle'], witnessNote: 'Thom and Bean heard the order while invisible in the office.',
    citations: [declaration], tellings: [sharedAccount],
    limits: 'This is a standing threat, not a recorded attack. Dax’s earlier warning and the specific threat against Thom were a different part of the meeting.',
  },
  {
    id: 'exchange-hatch', topic: 'exchange', title: 'The hatch behind the desk', basis: 'observed',
    statement: 'Thom and Bean watched Thornton and three guards descend. The hatch closed flush; Bean opened its catch and the two climbed down.',
    witnesses: ['thom', 'bean-hootwhistle'], witnessNote: 'The two infiltrators saw the hatch’s location, opened it and descended.',
    citations: [declaration, deskSearch], tellings: [sharedAccount],
    limits: 'The later escape hatch’s surface position and the full tunnel layout are unrecorded. Harbin received entrance information, but exactly which entrance information is unknown.',
  },
  {
    id: 'exchange-payment-line', topic: 'exchange', title: 'Bean’s ledger discovery', basis: 'observed',
    statement: 'Bean read a line recording gold paid to Dax for work he did for Holia.',
    witnesses: ['bean-hootwhistle'], witnessNote: 'Bean explicitly read the line while searching with Thom. That does not establish that Thom read it too.',
    citations: [deskSearch], tellings: [],
    limits: 'No amount or identifying job is given. Dax was absent, and no later telling of this line is recorded.',
  },
  {
    id: 'exchange-hall', topic: 'exchange', title: 'The underground hall', basis: 'reported',
    statement: 'Thom and Bean reported an occupied hall with roughly twenty to thirty people, maps, gold, unopened chests and Thornton’s private office.',
    witnesses: ['thom', 'bean-hootwhistle'], witnessNote: 'Their underground observations were recounted at the inn in Session 9.',
    citations: [account], tellings: [sharedAccount],
    limits: 'The headcount is an estimate, not a roster. They left the gold and chests untouched, and no orc alliance was established.',
  },
  {
    id: 'exchange-inferred-purpose', topic: 'exchange', title: 'Thom’s interpretation of the papers', basis: 'inferred',
    statement: 'Thom interpreted overheard fragments and document headings as a new foothold along the Sword Coast, a Phandalin base and possible smuggling.',
    witnesses: ['thom'], witnessNote: 'These are Thom’s interpretations. He read headings rather than the full pages.',
    citations: [account], tellings: [sharedAccount],
    limits: 'The theories do not confirm a smuggling operation, the purpose of the tunnels or an alliance with the orcs.',
  },
];

export const briefingItems: readonly BriefingItem[] = [
  {
    id: 'next-jobs', title: 'The work after the mine',
    text: 'The plan is to return to Phandalin for the cart, deliver provisions to Harbin’s unnamed half-brother at Loggers’ Camp, then investigate the reported orc attack at Butterskull Ranch. Both jobs promise 150 gp; neither journey nor collection of the supplies has happened.',
    citations: [{ sessionId: 'session-9', sceneId: 'scene-s9ba2a11016' }],
  },
  {
    id: 'dragon-evidence', title: 'The dragon remains unseen',
    text: 'A messenger reported Umbrage Hill destroyed. On the mine road, Bean, Hamish and Rut found that six dead orcs’ cold injuries looked like white-dragon work. The party witnessed neither attack and has not seen the dragon or found its lair.',
    citations: [{ sessionId: 'session-7', sceneId: 'scene-s67c94f30b5' }, { sessionId: 'session-9', sceneId: 'scene-s7bb5ada9e8' }],
  },
  {
    id: 'name-boundary', title: 'Sage knows Rut’s name',
    text: 'Rut told Sage his name over breakfast and allowed her to tell the others. She has not yet done so. The others still know him as Friend.',
    citations: [{ sessionId: 'session-9', sceneId: 'scene-sc1f02db775' }],
  },
  {
    id: 'norbus-unsettled', title: 'Norbus’s share remains uninformed',
    text: 'Norbus accepted 25 gp and 70 silver without knowing about the gems and emerald. Their later 500 gp sale did not settle his agreed share; no additional payment was recorded. Dax’s separate fifteen gold and offer of service remain private to Dax and Norbus.',
    citations: [{ sessionId: 'session-7', sceneId: 'scene-s79837e251b' }, { sessionId: 'session-7', sceneId: 'scene-s09baa7db28' }, { sessionId: 'session-9', sceneId: 'scene-s9ba2a11016' }],
  },
];

/** Reuse pilot claims instead of maintaining a second version in the briefing. */
export const briefingEvidenceIds = ['exchange-townmaster', 'exchange-kill-order', 'exchange-inferred-purpose'] as const;
