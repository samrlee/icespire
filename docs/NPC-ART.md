# NPC artwork inventory

Reviewed September 19, 2026. This is an asset inventory, not campaign canon.
“No verified portrait found” means none in the local official-art collection or
confirmed in the source search; it is not proof that none exists anywhere.

| NPC | Portrait status |
| --- | --- |
| Phantom | Generated campaign portrait, matched to the panther in Sage's existing portrait; assigned. |
| Don-Jon Raskin | Official Essentials Kit portrait by Olga Drebas, already in `public/images/creatures/don-jon-raskin.webp`; assigned. |
| Adabra Gwynn | No verified official individual portrait found. |
| Barthen | No verified official individual portrait found. |
| Dazlyn Grayshard | No verified official individual portrait found. |
| Norbus Ithermel | No verified official individual portrait found. |
| Harbin Wester | No verified official individual portrait found. |
| Guildmaster Holia Thornton | No verified official individual portrait found; searched the published spelling Halia too. |
| Facktoré | No verified official individual portrait found. The generic rock gnome image is not an identified portrait of her. |
| King Korboz | No verified official individual portrait found. |
| Queen Gnerkli | No verified portrait matching this campaign's character found. Do not import module differences into campaign canon. |
| The Zhentarim Guard | No verified official portrait of this particular guard found. |
| The White Dragon | Official young-white-dragon illustration already exists locally. Left unassigned: the party has not seen the dragon. |

## Sources and next choices

- [Olga Drebas's Essentials Kit portfolio](https://olgadrebas.artstation.com/projects/3oVn32)
  identifies the Don-Jon illustration and its official commission.
- [Phandalin Shop Cards, NPC Art, and Tokens](https://www.inchoatethoughts.com/phandalin-shop-cards-npc-art-and-tokens?swcfpc=1)
  includes Barthen, Halia and Harbin, but explicitly labels its collection
  unofficial fan content. These are not verified official portraits.
- Local references: `offical-assets/Creatures/`; existing optimized assets:
  `public/images/creatures/`. No reference scans were copied for this change.

The ten unillustrated humanoid NPCs are candidates for a future generation pass,
using established campaign descriptions and the party portraits' visual style.
Avoid presenting invented visual details as facts from play. Keep the white
dragon's portrait deferred until an appropriate discovery or editorial decision.

## Phantom generation provenance

Built-in image generation, with `public/images/characters/sage.webp` as the
identity and style reference. Final asset: `public/images/npcs/phantom.webp`,
800 × 800 WebP. Sage's original image is unchanged.

Prompt:

> Create a standalone square character portrait of Phantom, the black panther in the provided reference image. Reference role: identity and visual style reference, not an image to overwrite. Match this exact panther's natural black fur, subtle rosette markings, golden yellow eyes, broad feline muzzle, rounded ears and calm alert demeanor. Cinematic realistic fantasy portrait in the same natural mountain forest lighting and photographic texture as the reference. Head and upper chest, face centered and clearly readable as a small circular avatar, both ears fully within frame with generous margin. Softly blurred forest background. Phantom alone: no elf, no people, no hands, no collar, no armor, no magic effects, no text or border. Save a new portrait; preserve the source image.
