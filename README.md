# Digital Ganpati Pandal 🕉️

A walkable 3D recreation of the Purvanchal Maharashtra Mandal Ganesh Utsav pandal
(Anand Bhavan, Anand Vihar, Delhi), built with Three.js — no build step, no image
assets; everything in the scene is generated procedurally.

## Run

Any static server works (pointer-lock and audio are happier over http than file://):

```bash
cd ganpati-pandal
python3 -m http.server 8080      # or: npx serve .
# open http://localhost:8080
```

## Layout (from the sketch)

- **Porch** with black & white checkerboard tiles, welcome arch and marigold garland.
- **Entry** on the right wall → **red carpet** runs to the centre aisle and up to the pandal.
- **Pandal** at the back: satin-skirted stage, banner, pink star drapes, flower lattice,
  big murti on the upper platform, small murti in front with pooja items, brass lamps,
  flower pots, blue & warm stage spots.
- **Chairs** in rows either side of the aisle; windows, fans, ACs, speakers, clock.
- **Donation QR standee** to the right of the stage + acrylic donation box on the stage.
- **Temple bell** hanging to the left of the stage.

## Interactions

| Target                 | Action                                             |
|------------------------|----------------------------------------------------|
| Big / small murti      | Play / pause aarti (also the ▶ Aarti HUD button)   |
| QR standee / donation box | Opens donate popup with scannable UPI QR; on phones it deep-links straight to Paytm / UPI |
| Bell                   | Rings (synthesised, no file needed)                |

Controls — desktop: `WASD`/arrows walk, mouse look, `Shift` run, click or `E` interact, `Esc` pause.
Mobile: left joystick walks, drag to look, tap to interact.

## Real 3D models from Sketchfab

Sketchfab `<iframe>` embeds can't be placed inside a Three.js scene, so models are
downloaded as glTF and loaded with `GLTFLoader`. `config.js` → `models` maps each prop
(`bigMurti`, `smallMurti`, `oilLamp`, `incenseBurner`, `flowerPot`, `rosePot`, `pujaThali`)
to `assets/models/<key>/model.glb`. Missing files fall back to the built-in procedural props.

1. Get an API token: sketchfab.com → Settings → Password & API → *API token*.
2. `SKETCHFAB_TOKEN=xxxx node download-models.mjs`

3. Compress each download (raw Sketchfab exports are 20–80 MB each; compressed they're 0.4–4 MB):
   `npx @gltf-transform/cli optimize assets/models/<key>/scene.gltf assets/models/<key>/model.glb --compress draco --texture-compress webp --texture-size 1024 --simplify-ratio 0.5 --no-flatten`

This fetches the free CC-BY models (your picks *Golden Oil Lamp*, *Rose in a pot*,
*Puja Thali Set*, plus free stand-ins for the paid ones). Their attributions are
shown automatically on the intro screen (required by CC-BY).

**Paid Store models you chose** — *Lord Ganesha 01*, *Lord Ganesha Hindu Deity 03*,
*Incense Burner – Tubix*, *Stylized Flower Pot* — are not downloadable via the API.
Buy them on Sketchfab, download as glTF, and unzip into the matching folder
(e.g. `assets/models/bigMurti/scene.gltf`); the app will pick them up. Note the two
Ganesha models are ~2M faces each — heavy for a browser scene. If it stutters, decimate
them in Blender (Decimate modifier to ~200k faces) before exporting.

## Performance on phones

A **lite mode** switches on automatically on touch devices / low-core / low-memory devices
(force it with `?lite`, or force full quality with `?hd`): no shadows or antialiasing,
pixel ratio 1, fewer point lights, fewer petals, and the heavy models (lamps, pots, incense
burner) are replaced by the built-in low-poly props. Full mode renders ~1M triangles, lite ~190k.

## Configure

Edit `config.js`:

- `upi.id` — the mandal's UPI id; the QR in the hall is generated from it.
- `paymentLink` — optional Paytm link shown as an extra button.
- `aarti[]` — playlist. Drop mp3 files into `assets/aarti/` and list them
  (e.g. `sukhkarta-dukhharta.mp3`, `jai-dev-jai-dev.mp3`).
- Banner text, dates and venue (year is 2026; confirm the festival dates).
