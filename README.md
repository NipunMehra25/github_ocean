# GitHub Ocean

Interactive Three.js experience that maps a GitHub profile to an ocean creature based on commit and repository activity.

## Project Structure

```text
github_ocean/
  index.html
  site.webmanifest
  README.md
  src/
    main.js
    style.css
  assets/
    models/        # .glb fish/creature models
    shaders/       # GLSL background shader
    fonts/         # custom font assets
    icons/         # favicon + app icons
    media/         # background video/audio media
  docs/
    FISH_MAPPING.md
```

## Run Locally

Use any static server (required for module imports and asset loading).

```bash
# Option 1 (Node)
npx serve .

# Option 2 (Python)
python -m http.server 8080
```

Then open:

- `http://localhost:3000` (`serve`)
- `http://localhost:8080` (`python`)

## How It Works

- User enters GitHub username and clicks `Dive`.
- App fetches:
  - Profile (`public_repos`)
  - Commit count (GitHub search API)
- App calculates 2D tier mapping:
  - Commit bucket
  - Repo bucket
- Resulting tier maps to one creature model.
- Overlay shows:
  - Assigned creature
  - Tier matrix
  - Commit/repo band
  - Creature lore

Mapping details are in [docs/FISH_MAPPING.md](./docs/FISH_MAPPING.md).

## Customization Guide

All key customizations live in [src/main.js](./src/main.js).

### 1. Reorder Tier Positions

Use `FISH_TIER_INDEX_OVERRIDES` (1-based tier index):

```js
const FISH_TIER_INDEX_OVERRIDES = {
  "Guppy": 5,
  "Reefback": 26
};
```

### 2. Adjust Model Size

Use `MODEL_SIZE_OVERRIDES`:

```js
"Reefback": 3.0
```

- `1.0` = default
- `>1.0` bigger
- `<1.0` smaller

### 3. Adjust Position/Rotation (Simple Names)

Use `MODEL_VIEW_TUNING`:

```js
"Reefback": {
  leftRight: 0.2,
  upDown: -0.1,
  frontBack: 0.0,
  turn: 0.0,
  tilt: 0.0,
  bank: 0.0
}
```

- `leftRight`: horizontal movement
- `upDown`: vertical movement
- `frontBack`: depth movement
- `turn`: yaw-like rotation
- `tilt`: pitch-like rotation
- `bank`: roll-like rotation

### 4. Force Facing Direction

Use `MODEL_BASE_TURN_OVERRIDES`:

```js
"Reefback": Math.PI * 0.5
```

### 5. Select Specific Animation Clip

Use `MODEL_ANIMATION_CLIP_OVERRIDES`:

```js
"Apex Leviathan": "Armature.001|Armature.001|Armature.001|Armature.001|Take 001|BaseLayer"
```

### 6. Fish-Specific Sounds + Ocean Ducking

- Ocean ambience auto-mutes while fish is visible in dive view.
- Fish sound loop plays per fish (if file exists).

Drop files in:

- `assets/audio/fish/<fish_slug>.mp3`

Example slugs:

- `guppy.mp3`
- `reefback.mp3`
- `apex_leviathan.mp3`

Optional explicit mapping is available in `src/main.js` via:

- `FISH_SOUND_PATH_OVERRIDES`

## Styling

UI and responsive behavior are in [src/style.css](./src/style.css), including:

- Desktop/tablet/phone breakpoints
- Touch-safe layout rules
- Reduced-motion fallback
- Professional glass panel styles

## Notes

- `fish_assets/` may appear as an empty legacy directory on some systems due a temporary OS file lock. It is no longer used by the app.
- Core runtime paths now resolve from:
  - `src/main.js` -> `../assets/...`
  - `src/style.css` -> `../assets/...`
