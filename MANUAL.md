# Guide to use Squish 

Everything Squish can do, and how it works. For the quick start, see the [README](README.md).

---

##Features

- **Real 3D, real translucency** — a WebGL sphere (Three.js) with a physically-based glassy material: soft refraction, a clearcoat sheen and
  environment lighting. Spin it a full 360 degrees to see every side.
- **Grab to spin *and* squish** — press and drag to rotate the ball while mashing it; the faster you drag, the more it deforms. Let go and it flings.
- **Springy squash-and-stretch** — a hand-rolled spring makes it jiggle on every hit, bounce and wall-smack.
- **Click-to-rev energy** — rapid clicking pumps it up so it ricochets harder; stop and it calms down and drifts back to the middle.
- **Motion-speed control** — a comfort slider caps how fast it moves. Turn it down for a gentle, slow drift (helpful if fast motion bothers you); up for chaos!
- **Sparkles** — a little burst of light every time you squish it.
- **Ball · Fruit · Veggie** — a colour ball, or fruit/veg in their real shape (a pineapple looks like a pineapple), each with a simple smile you can toggle off.
- **Settings that stick** — appearance (dark/light), type, colour, size, transparency, motion speed, smile, sound and "keep on top" are all adjustable and remembered between launches.
- **Desktop pet mode** — as an app it has no window or frame: just the ball, floating and wandering over your whole desktop, always on top. Clicks pass straight through to your desktop everywhere *except* on the ball, so nothing gets in your way. Leave it alone for 3 minutes and it curls up to doze near the Dock; click it to wake it.
- **Offline-friendly** — the 3D library is bundled in the repo; nothing is fetched at runtime except an optional web font.

---

## Controls

| Action | What it does |
| --- | --- |
| Click / tap | Bounce + squish + sparkles |
| Click fast, over and over | Builds energy → faster, wilder bouncing |
| Press + drag | Spin the ball 360° and squish it; release to fling |
| Space bar | Bounce |

### The menu bar icon

Since the floating ball has no window, the little Squish icon in your menu baris the control panel: **Settings, Wake it up, Rest now, Reset to centre and Quit Squish.**

### Settings

Open from the **menu bar icon -> Settings**, or move the pointer to the top-right corner of the screen to reveal settings icon.

- **Appearance** — dark or light panel.
- **Type** — ball, fruit, or veggie (fruit/veg keep their real shape).
- **Colour** — presets plus a custom colour picker (ball mode).
- **Size** — from the full ball down to one third of it.
- **Transparency** — solid colour through to ghostly glass.
- **Motion speed** — how fast it's allowed to move.
- **Smile** — show the face or not.
- **Sound** - the soft pop on each squish.

Everything is saved between launches.

---

## Building and installing

### Make an installable app (with the icon)

```bash
npm run dist
```

The finished app lands in `dist/` — a `.dmg` (and a `Squish.app`) on macOS, an installer and a portable `.exe` on Windows, an `AppImage` on Linux. Build installers for an OS *on* that OS.

### Quit

The floating ball has no window chrome, so quit from the **menu-bar (Squish)
icon → Quit Squish**, or right-click the icon in the Dock → Quit.

### Take a quick look!

Open **`renderer/index.html`** in a browser — it works without Node and shows the ball on a backdrop (the transparent floating behaviour is only in the desktop app).

### First launch on macOS

Because the app is built locally and isn't signed by Apple, macOS may call it an *"unidentified developer."* That's expected — instead of double-clicking, **right click the app and then Open**, then click **Open**. You only do this once.

---

## How it works

The ball is a Three.js `MeshPhysicalMaterial` sphere with **transmission** (the glassy, see-through part), lit by an ambient + two directional lights and a small procedural environment map so the surface has something to reflect. The transparency slider drives the material's transmission and opacity together, so it goes from a solid coloured ball to ghostly glass.

Motion is a tiny physics loop. The ball carries a position and velocity in 3D space and bounces off the edges of the view; an **energy** value (0–1) climbs with each click and decays over time, scaling both the impulse per click and the speed cap — all multiplied by the **motion-speed** setting. The jiggle is a damped spring on a squash value that flattens and bulges the shape (squash-and-stretch). Dragging feeds pointer movement straight into rotation (plus angular momentum for the spin-after-release) and into the squash, so a grab both turns and mashes it. The face is painted on a 2D canvas; fruit and veggies are drawn as a billboarded emoji so they keep their real silhouette.

Electron wraps it in a transparent, frameless, always-on-top window that covers the desktop and ignores clicks except where the pointer is on the ball (the renderer toggles that as you hover). A small preload bridge connects the window and the page, and a tray icon handles the rest.

---

## Project structure

```
squish/
├─ main.js              #Electron main process: the floating overlay + tray
├─ preload.js           #safe bridge between the window and the page
├─ package.json         #scripts, dependencies, build config
├─ build/
│  └─ icon.png          #app icon (1024×1024)
└─ renderer/            #the app UI
   ├─ index.html
   ├─ styles.css
   ├─ script.js         #the 3D ball, physics, and settings
   └─ vendor/
      └─ three.min.js   #bundled Three.js (r158), so it runs offline
```

---

## Customising

Skins live at the top of `renderer/script.js`:

```js
const BALL_COLORS = ["#8C9EFF", /* add a hex */ ];
const FRUITS  = ["🍎", "🍊", /* emoji */ ];  const F_TINTS = ["#E8614D", /* its tint */ ];
const VEGGIES = ["🥦", "🥕", /* emoji */ ];  const V_TINTS = ["#6BBF59", /* its tint */ ];
```

Swap `build/icon.png` for your own 1024×1024 image to change the app icon.

---

## Troubleshooting

- **`npm run dist` produced no `.dmg`** — code-signing is already disabled in `package.json`; also check for `Squish.app` inside `dist/`. If it still fails, run `npm run pack` (builds just the `.app`).
- **The menu shows no "Settings…"** — you're running an older installed copy. Quit it, delete the old app from Applications, and run `npm start` from this folder (or rebuild).
- **Fonts look plain offline** — the UI font (Fredoka) loads from Google Fonts; without internet it falls back to a system rounded font. Harmless.

---

## Tech

Electron, Three.js / WebGL, vanilla JavaScript, CSS, Web Audio API, Pointer Events. No UI frameworks.

## License

MIT — see [LICENSE](LICENSE).
