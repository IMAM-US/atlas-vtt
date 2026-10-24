# Renderer boundaries and research notes

Checked: **2026-10-01**. The dated facts below should be rechecked before a future implementation depends on them. The design recommendations elsewhere in the package are authored synthesis, not measured claims about image quality.

## Current OpenAI image workflow

OpenAI's current announcement identifies **ChatGPT Images 2.5**. Its API counterparts are GPT-Image-2.5 Flare and Sunburst. This package deliberately does not pin a model or send API requests: its image instructions can be handed to the current available ChatGPT image creator. ChatGPT interface controls, API controls, requested export properties and observed output properties are distinct. [1]

OpenAI's prompting guide treats prose and JSON-like formats as ways to organize intent, not a special control language. This skill uses JSON for editability and traceability, then derives plainly worded image instructions. It assigns each reference a purpose and makes edit-preservation requirements explicit. [2]

Image generation still has limitations in exact text placement, composition and consistency. Neither normalized coordinates nor a source lock guarantees a corresponding pixel-level constraint. Put exact overlays in a separate workflow and inspect the rendered map before declaring it ready for play. [3]

## Dimensions: an API example, not a promise about ChatGPT

The current OpenAI API reference supports flexible dimensions for the 2.5 models, with divisibility and aspect-ratio restrictions; it describes resolutions above 2560 by 1440 as experimental. Those documented backend settings do not establish which controls a given ChatGPT session exposes. The two example specs' `target_pixels` values are therefore delivery targets rather than automatically executed native requests. [4]

Do not make an 8K claim because the prompt says “8K.” After a later rendering step, inspect the returned file. Upscaling can change pixel dimensions but is not proof that missing architectural or tactical detail has been recovered. Cropping can change composition. Independently rendered tiles do not guarantee matching seams. None of these operations is performed by this package.

No provider-specific seed, sampler, CFG scale, prompt weighting syntax, model parameter JSON, API exporter or automatic image-generation integration is implemented here.

## What the user's map references contribute

| Reference | Verified observation | Design takeaway for this skill |
|---|---|---|
| Czepeku | The fantasy library emphasizes hand-drawn map collections and packs with multiple variations. [5] | Treat a map as a coherent base location with deliberately controlled variants. Write concrete visual traits instead of only naming a publisher. |
| 2-Minute Tabletop | It describes hand-drawn maps/assets prepared for print or VTT use. [6] | Keep the graphic treatment legible and distinguish map artwork from the setup needed to use it. |
| Roll20 Marketplace | An inspected map-pack listing includes day/night and gridded/gridless editions of the same locations. [7] | Separate environmental variants from grid presentation; derive both from the approved base when practical. |
| DriveThruRPG | Search-indexed publisher/product results identify battlemaps and gridless collections, but the main site and a selected product returned access errors during direct retrieval. [8] | Retain it as the requested broad marketplace reference; do not infer a single consistent house style or pretend to have inspected blocked product art. |

These are curation references, not evidence that this skill can match a professional artist's output on demand. No marketplace map art is included or licensed by this package. Specific marketplace submission rules and commercial rights are outside its scope.

Roll20's alignment documentation distinguishes map dimensions from grid settings and describes matching map images to the grid. That is consistent with the package's separate calibration step. Exact destination-VTT behavior should be checked when the image is eventually imported. [9]

## Skill packaging

OpenAI's skill documentation describes a directory with a required `SKILL.md` containing name and description, plus optional scripts, references and assets. It documents `.agents/skills` repository discovery and `$HOME/.agents/skills` for local user skills. This is why the package uses that structure. Creating these files is not the same as installing them in the user's account. [10]

## Sources

1. OpenAI, *Introducing ChatGPT Images 2.5*, September 8, 2026: https://openai.com/index/introducing-chatgpt-images-2-5/
2. OpenAI, *Image prompting*: https://developers.openai.com/api/docs/guides/image-prompting
3. OpenAI, *Image generation — Limitations*: https://developers.openai.com/api/docs/guides/image-generation
4. OpenAI, *Create image API reference*: https://developers.openai.com/api/reference/resources/images/methods/generate
5. Czepeku, fantasy library: https://www.czepeku.com/fantasy
6. 2-Minute Tabletop, main collection: https://2minutetabletop.com/
7. Roll20 Marketplace, *Battlemaps Pack 1*: https://marketplace.roll20.net/browse/set/25199/battlemaps-pack-1
8. DriveThruRPG, requested marketplace: https://www.drivethrurpg.com/ ; search-indexed Heroic Maps publisher page: https://www.drivethrurpg.com/en/publisher/5371/heroic-maps ; selected gridless collection, direct fetch blocked: https://www.drivethrurpg.com/en/product/522463/d100-map-pack-100-gridless-battlemaps-for-fantasy-ttrpgs
9. Roll20 Help, *Sizing and Aligning Maps*: https://help.roll20.net/hc/en-us/articles/360039243994-Sizing-and-Aligning-Maps
10. OpenAI, *Build skills*: https://developers.openai.com/codex/build-skills (redirected to https://learn.chatgpt.com/docs/build-skills when checked).
