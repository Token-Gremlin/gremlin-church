# Basilica of Celestial Light

A palace-cathedral raised entirely from code: an explorable, fully procedural Three.js experience in the browser.

There are no models, no image textures and no downloaded assets. Every stone, arch, window, flame, tree, mountain, sound and note of music is generated when the page loads: parametric gothic architecture, canvas- and shader-generated materials, painted stained glass, volumetric light, and a synthesized WebAudio soundscape.

## Run it

Requirements:

- [Node.js](https://nodejs.org) 20.19+ or 22.12+
- A browser with WebGL 2 (Chrome, Edge, Firefox or Safari 17+)
- A GPU. A dedicated card or a recent integrated one runs it smoothly; software rendering works but is very slow (see `?lite` below).

```bash
git clone https://github.com/Token-Gremlin/gremlin-church.git
cd gremlin-church
git checkout cursor/procedural-cathedral-4bb5   # until the pull request is merged into main
npm install
npm run dev
```

Open <http://localhost:5173>. The world is built in the browser on load (a few seconds on a typical machine), then the title screen offers **Walk freely** or **Guided tour**.

For an optimized build: `npm run build && npm run preview`, then open <http://localhost:4173>. The `dist/` folder is a static site that can be hosted from any folder.

## Controls

| Input | Action |
| --- | --- |
| Click | Capture the mouse to look around (Esc releases it) |
| W A S D / arrow keys | Walk |
| Shift | Run |
| Mouse wheel | Zoom |
| E | Interact: light a votive candle, ring the bell |
| T | Guided tour (← → skip between stops, Esc returns to free walking) |
| F | Toggle flight (Space / C to rise and descend) |
| N | Change the hour: late afternoon ↔ night |
| M | Sound on / off |
| Q | Cycle quality |
| P | Photo mode (hide the interface) |
| H | Help |
| \` | Show frames per second |

Touch devices get an on-screen stick and drag-to-look.

## Quality and URL options

- Pick **Low / Medium / High / Ultra** on the title screen or press **Q** in-game. The default is High on desktop and Low on touch devices. Dynamic resolution lowers the render scale automatically when the frame rate drops.
- `?q=low|medium|high|ultra` starts at a given quality, e.g. <http://localhost:5173/?q=medium>.
- `?lite` is for machines without a GPU: no shadow pass, deeper resolution scaling, and movement that stays real-time at low frame rates. Combine with `?q=low&lite`.

## What to explore

- **The Promenade and West Terrace**: cypress avenue, lanterns, angels, the grand stair and the Portal of Kings beneath two spired towers.
- **The Nave**: clustered piers, a lapis-and-gold star vault, chandeliers, and clerestory glass that pours coloured light onto the marble floor.
- **The Crossing**: a painted celestial dome on a windowed drum, with the transept rose windows.
- **The Choir and High Altar**: carved stalls, gilded reredos with statues, the apse glass.
- **The West Organ**: a generated pipe organ in the loft above the west doors, beneath the great west window.

Secrets hide in the bell tower, beneath the choir, beyond the south transept, and through the Gallery of Saints: a Lady Chapel, a candle-lit crypt with a reflecting pool, a spiral stair to a belvedere with a bell you can ring, and a cloister garden with a fountain and tempietto. At night the glass glows from within and the exterior is floodlit.

## How it is built

```
src/
  arch/          Parametric gothic vocabulary: pointed arches, sweeps, lathes, piers,
                 rib vaults, tracery windows, pinnacles, spires, balustrades; a Batcher
                 that merges geometry per material and zone
  world/
    cathedral/   Nave, crossing and dome, choir and apse, west end and organ, exterior
                 shell with towers and flying buttresses, loggia, chapels, crypt, turret
    landscape/   Terrace, stairs and promenade, cloister garden, plateau, lake,
                 mountains and waterfalls
    props/       Pews, chandeliers, candelabra, statues, altar and reredos, votives
    Lighting.js  Sun, sky and environment lighting blended between outside, inside and night
    places.js    Named zones for place titles, interior/exterior blending, footstep surfaces
  textures/      Generated marble, wood, velvet, gold mosaic, the celestial dome painting
                 and the stained glass (figures, mosaics, rose windows)
  materials/     Triplanar stone, foliage and glass materials
  shaders/       Noise, inlaid floor patterns drawn with signed distance fields
  fx/            Volumetric light shafts with coloured floor pools, candle flames and lights
  engine/        Render pipeline (HDR, bloom, sun rays, colour grading), planar reflections,
                 collision, first-person controls, guided tour
  audio/         WebAudio synthesis: organ and choir, wind, water, birds, crickets,
                 footsteps, bell, and reverb for inside and outside
  ui/            Title screen, HUD, captions, toolbar and help
```

Built with [Three.js](https://threejs.org) and [Vite](https://vite.dev).
