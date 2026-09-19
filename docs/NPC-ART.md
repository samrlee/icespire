# NPC artwork inventory

Reviewed September 19, 2026. This is an asset inventory, not campaign canon.
“No verified portrait found” means none in the local official-art collection or
confirmed in the source search; it is not proof that none exists anywhere.

| NPC | Portrait status |
| --- | --- |
| Phantom | Generated campaign portrait, matched to the panther in Sage's existing portrait; assigned. |
| Don-Jon Raskin | Official Essentials Kit portrait by Olga Drebas, already in `public/images/creatures/don-jon-raskin.webp`; assigned. |
| Adabra Gwynn | Generated campaign portrait assigned; no verified official individual portrait found. |
| Barthen | Generated campaign portrait assigned; no verified official individual portrait found. |
| Dazlyn Grayshard | Generated campaign portrait assigned; no verified official individual portrait found. |
| Norbus Ithermel | Generated campaign portrait assigned; no verified official individual portrait found. |
| Harbin Wester | Generated campaign portrait assigned; no verified official individual portrait found. |
| Guildmaster Holia Thornton | Generated campaign portrait assigned; no verified official individual portrait found. |
| Facktoré | Generated campaign portrait assigned; no verified official individual portrait found. |
| King Korboz | Generated campaign portrait assigned; no verified official individual portrait found. |
| Queen Gnerkli | Generated campaign portrait assigned; no verified official individual portrait found. |
| The Zhentarim Guard | Generated campaign portrait assigned; no verified official individual portrait found. |
| The White Dragon | Official young-white-dragon illustration already exists locally. Left unassigned: the party has not seen the dragon. |

## Sources and next choices

- [Olga Drebas's Essentials Kit portfolio](https://olgadrebas.artstation.com/projects/3oVn32)
  identifies the Don-Jon illustration and its official commission.
- [Phandalin Shop Cards, NPC Art, and Tokens](https://www.inchoatethoughts.com/phandalin-shop-cards-npc-art-and-tokens?swcfpc=1)
  includes Barthen, Halia and Harbin, but explicitly labels its collection
  unofficial fan content. These are not verified official portraits.
- Local references: `offical-assets/Creatures/`; existing optimized assets:
  `public/images/creatures/`. No reference scans were copied for this change.

All ten humanoid NPCs now have generated portraits. These are artistic
interpretations where play has not established appearance, not new canon.
Dazlyn is depicted alive; the guard's face stays concealed; Gnerkli follows
this campaign's Queen. The white dragon remains deferred until discovery or
an explicit editorial decision.

## Description cross-check

Samuel authorized checking published NPC descriptions for portrait guidance.
The D&D Beyond adventure chapters redirected to the purchase page, so the full
publisher text was not independently accessible. The following secondary
summaries cite the adventure; they are not themselves official publications.
No new module story facts were imported into campaign prose.

- [Korboz](https://forgottenrealms.fandom.com/wiki/Korboz) and
  [Gnerkli](https://forgottenrealms.fandom.com/wiki/Gnerkli): patchwork capes
  and jagged metal crowns, citing *Dragon of Icespire Peak*, p. 26. Both
  portraits were revised accordingly. This campaign's Gnerkli remains Queen.
- [Adabra](https://forgottenrealms.fandom.com/wiki/Adabra_Gwynn): midwife and
  apothecary serving Chauntea. No precise face, hairstyle or age established by
  the retrieved description; those remain illustration choices.
- [Dazlyn](https://forgottenrealms.fandom.com/wiki/Dazlyn_Grayshard) and
  [Norbus](https://forgottenrealms.fandom.com/wiki/Norbus_Ironrune): dwarf
  prospectors. Campaign brotherhood, pronouns and names take precedence over
  differences in module summaries. No new biographical facts were added.
- [Halia/our Holia](https://forgottenrealms.fandom.com/wiki/Halia_Thornton):
  calculating human guildmaster. Precise facial features remain interpretive.
- Barthen's lean, balding appearance around age fifty is corroborated by
  [a D&D Beyond community reproduction of the Phandalin description](https://www.dndbeyond.com/forums/dungeons-dragons-discussion/play-by-post/159029-dragon-of-icespire-peak-the-return-of-the-white).
  This is a community post, not publisher verification. The selected image is
  compatible with that limited description.
- Harbin's portliness and nervousness already appear in our Session 4 recap.
  Facktoré's gnome ancestry and tinkering are established in Session 2.
  No verified exact individual facial description was found for either.
- The guard has no established face in this campaign and stays concealed.

## Humanoid portrait generation provenance

Generated with the built-in image tool, using Sage's portrait as a visual-style
reference. Exact prompts are in [npc-portrait-prompts.json](npc-portrait-prompts.json).
Each final asset is `public/images/npcs/<npc-slug>.webp`, 800 × 800 pixels.
The source portrait is unchanged. All eleven generated images are credited as
AI-generated campaign portraits; Don-Jon's official-art credit stays separate.

## Phantom generation provenance

Built-in image generation, with `public/images/characters/sage.webp` as the
identity and style reference. Final asset: `public/images/npcs/phantom.webp`,
800 × 800 WebP. Sage's original image is unchanged.

Prompt:

> Create a standalone square character portrait of Phantom, the black panther in the provided reference image. Reference role: identity and visual style reference, not an image to overwrite. Match this exact panther's natural black fur, subtle rosette markings, golden yellow eyes, broad feline muzzle, rounded ears and calm alert demeanor. Cinematic realistic fantasy portrait in the same natural mountain forest lighting and photographic texture as the reference. Head and upper chest, face centered and clearly readable as a small circular avatar, both ears fully within frame with generous margin. Softly blurred forest background. Phantom alone: no elf, no people, no hands, no collar, no armor, no magic effects, no text or border. Save a new portrait; preserve the source image.
