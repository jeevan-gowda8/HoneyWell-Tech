# Honeywell Technologies

An interactive virtual laboratory for the sample items from `Specs_33_Sample_Items_Print.docx`, built with React and Vite in a light-only theme.

The flow is three steps:

1. **Kits**: every kit appears as its own card. Search, or filter by discipline and level (UG Lab, PG Lab, Equipment).
2. **Experiments**: selecting a kit lists its experiments, along with the full specification from the Word file.
3. **Simulation**: selecting an experiment opens a working model of the kit for that experiment.

## Getting started

Requires Node.js 20 or newer.

```bash
npm install
npm run dev       # development server, usually http://localhost:5173
npm run build     # production build in dist/
npm run preview   # serve the production build
```

The build uses relative paths and hash routing, so `dist/` can be hosted from any static server or sub-folder without extra configuration.

## What each simulation includes

| Area | Description |
| --- | --- |
| Controls | Sliders, selectors and switches. Their ranges follow the kit specification wherever it gives one. |
| Live apparatus | An animated drawing of the kit with its displays, meters and oscilloscope. Some kits also have switches you can click directly on the board. |
| Guide | Aim, principle, formula and a tick-off procedure. |
| Observations | Record readings one at a time, or use **Auto-collect** to run the whole series. Export to CSV. |
| Graph | Readings, best-fit line, kit response curve and a live marker. Hover for values. |
| Result | The calculated answer, compared with the expected value and shown as a percentage difference. |

Readings include a small random scatter so that results behave like real measurements. Time-varying displays can be paused or run at ¼× and 3×.

## Realistic kit panels and particle view

- **PhyUGEx-61 (Series and Parallel LCR)** is a replica of the real front panel. Drag between brass sockets to patch cords and click a cord to remove it. The knobs turn, and the arrow and waveform buttons work. Any wiring is solved as an AC network, so an open circuit, a short circuit or an alternative layout behaves accordingly.
- **PhyUGEx-242 (Full Adder and Subtractor)** is a replica of the real front panel. Flip the eight Logic Input switches, patch them to the gates, and read Logic Output LEDs, the BCD displays and the 16x4 LCD. Clock outputs, the +5 V supply and the mono pulser all work. Every wiring is evaluated as 74-series logic, so an unconnected gate input reads high and two outputs driving one socket are reported as a conflict.
- **PhyUGEx-2 (Bar Pendulum)** is a 3D model built from the kit's product photo: steel bar with real holes on a knife-edge stand, photogate, digital stop clock and oscillation counter. Drag the bar or bob to release it, click a hole to re-hang the bar, and press the buttons on the instruments. The counter times real crossings of the photogate. 
- **PhyUGEx-11 (Coupled Oscillator)** is a 3D model built from the kit drawings: two 1 m pendulums, a helical spring on sliding clamps, magnetic sensors and the data acquisition unit with a live LCD, bar graph and buttons. The pendulums follow the coupled equations of motion, so normal modes and beats appear from any release.
- The 3D engine (three.js, about 140 kB compressed) loads only for the 3D kits.
- **PhyUGEx-44 (Network Theorems Trainer)** is a flat replica of the kit's front panel. Every socket belongs to one network solved by nodal analysis, so the voltmeter and ammeter read whatever is wired. Range knobs, S1 and S2, load controls and the mains switch all work, and all six theorems are measured from the meters.
- **PhyUGEx-48 (Brewster's Law: Refractive Index)** is a 3D model of the kit: laser and polarizer on the bench, glass plate on the goniometer and a detector on a rotating arm. The reflected beam leaves at twice the incidence angle, and the detector reads it only when aligned.
- **PhyUGEx-74 (Thomson e/m)** is a 3D model of the kit: CRT on an acrylic stand over the graduated wing bridge, bar magnets, compass and HT/LT supply. Sliding the magnets and turning the deflection knob move the spot on the screen.
- **PhyUGEx-80 (Michelson Interferometer)** is a 3D model of the kit on its lab jack, with an inset showing the live fringes through the telescope. The coarse drum and fine micrometer move M1, and the screws behind M2 tilt it.
- **PhyUGEx-98 (Hall Effect in Semiconductor)** is a 3D model of the kit: electromagnet, Ge crystal with oven in the pole gap, InAs probe and the three instruments, all operated on their panels. The sample voltage shown by VH/VR assumes an 80 Ω crystal.
- **PhyUGEx-101 (Fermi Energy of Copper)** is a 3D model of the kit: copper coil in a glass tube, beaker of hot water, kettle, probe thermometer and the constant current unit. The kettle heats the water and the four leads can be unplugged.
- **PhyUGEx-105 (Dielectric Constant)** and **PhyUGEx-107 (B–H Curve)** are 3D models of their kits. The dielectric kit has a working capacitance meter, liquid cell and micrometer plates. The B–H kit draws the live loop on its oscilloscope.
- **PhyUGEx-161 (Quincke's Method)** and **PhyUGEx-201 (Angstrom's Thermal Conductivity)** are 3D models of their kits. Quincke's kit has a travelling microscope with a live eyepiece view; on the model the rise is drawn larger than true size. Angstrom's kit shows the heat wave moving along the copper rod and the four thermocouple readings.
- **PhyUGEx-214 (Faraday's Law)** and **PhyUGEx-250 (Seebeck and Peltier Effect)** are 3D models of their kits. In the Faraday kit the magnet falls in slow motion and the data logger inset plots the EMF pulse as it passes the coil. In the Seebeck and Peltier kit the sinks change colour with temperature, and swapping the leads reverses the heat flow.
- **PhyUGEx-256 and PhyPGEx-17 (Franck–Hertz)** and **PhyUGEx-262 (Lissajous Figures)** are 3D models of their kits. The Franck–Hertz tube shows orange glow layers appearing as the voltage rises. The Lissajous trainer has draggable patch cords between its console and the oscilloscope.
- **PhyUGEx-268 (Operational Amplifier)** and **PhyUGEq-1 (Dual Regulated DC Power Supply)** are 3D models of their kits, and **PhyPGEx-18** shares the 3D Brewster model. The op-amp board shows each circuit with patch cords and live input and output traces. The supply has a working keypad, encoder and rheostat load.
- **PhyPGEx-20, PhyPGEx-32, PhyPGEx-61, PhyPGEx-62, PhyPGEx-103 and PhyPGEx-114** are 3D models of their kits, built with the shared helpers in `src/sims/kit3d.jsx`.
- **EleEq-37 (AM Modulation Trainer)** is a pair of 3D boards drawn from the transmitter and receiver pictures, with live patch cords, a tuning dial and the fault DIP switches.
- **All 31 kits run as interactive 3D simulations.** PhyUGEx-35 and EleEq-47 are full 3D scenes. PhyUGEx-44, PhyUGEx-61 and PhyUGEx-242 keep their live, wireable panels inside a 3D instrument case drawn with `CSS3DRenderer`.
- **Particle view:** every experiment has a live canvas below the kit showing what happens inside it: electrons in the copper lattice, charge and magnetic field in L and C, holes in a Hall crystal, neon atoms being excited, photons, magnetic moments and more.
- Conductors on the kit show moving electrons and light beams show moving photons.

Other kits use a realistic black or PCB instrument style. They can be rebuilt as exact replicas like the LCR kit once a photo of each front panel is available.

The patchable panels live in `src/sims/lcrpanel.jsx` and `src/sims/adderpanel.jsx`. Particle scenes live in `src/components/Micro.jsx`, and `src/sims/micromap.js` connects each experiment to its scene.

## Kits and experiments

There are 31 kits and 103 experiments.

| Code | Kit | Experiments |
| --- | --- | ---: |
| PhyUGEx-2 | Bar Pendulum | 4 |
| PhyUGEx-11 | Coupled Oscillator | 4 |
| PhyUGEx-35 | Air Wedge | 3 |
| PhyUGEx-44 | Network Theorems Trainer | 6 |
| PhyUGEx-48 | Brewster's Law: Refractive Index | 2 |
| PhyUGEx-61 | Series and Parallel LCR | 3 |
| PhyUGEx-74 | Thomson e/m | 2 |
| PhyUGEx-80 | Michelson Interferometer | 2 |
| PhyUGEx-98 | Hall Effect in Semiconductor | 9 |
| PhyUGEx-101 | Fermi Energy of Copper | 1 |
| PhyUGEx-105 | Dielectric Constant | 2 |
| PhyUGEx-107 | B–H Curve | 3 |
| PhyUGEx-161 | Quincke's Method | 2 |
| PhyUGEx-201 | Angstrom's Thermal Conductivity | 1 |
| PhyUGEx-214 | Faraday's Law | 3 |
| PhyUGEx-242 | Full Adder and Subtractor | 2 |
| PhyUGEx-250 | Seebeck and Peltier Effect | 2 |
| PhyUGEx-256 | Franck–Hertz: Ionization Potential | 2 |
| PhyUGEx-262 | Lissajous Figures | 4 |
| PhyUGEx-268 | Operational Amplifier Trainer | 8 |
| PhyUGEq-1 | Regulated DC Power Supply | 3 |
| PhyPGEx-17 | Franck–Hertz Experiment | 2 |
| PhyPGEx-18 | Brewster's Law of Polarization | 2 |
| PhyPGEx-20 | Refractive Index of Thin Glass | 2 |
| PhyPGEx-32 | Ultrasonic Interferometer | 5 |
| PhyPGEx-61 | Curie Temperature | 1 |
| PhyPGEx-62 | B–H Curve: Hard and Soft | 4 |
| PhyPGEx-103 | Zeeman Effect | 2 |
| PhyPGEx-114 | Millikan's Oil Drop | 2 |
| EleEq-37 | AM Modulation Trainer | 7 |
| EleEq-47 | Fiber Optic Trainer | 8 |

Where the Word file lists functional or experimental capabilities, those became the experiments. Where it gives only a title and hardware list, experiments were chosen to fit that hardware. For the Raspberry Pi, which lists no experiments, they are drawn from its GPIO, thermal and power specifications.

## Project structure

```
src/
  main.jsx, App.jsx        Entry point and routes
  styles.css               Design tokens and all styling (light theme only)
  data/
    specs.json             Specifications extracted from the Word file
    kits.js                Source list of kits, used to generate catalog.json
    catalog.js             Kit names and experiment titles for the catalog pages
    sims.js                Loads a kit's simulations on demand
  pages/                   Home (kits), Kit (experiments), Experiment (simulation)
  components/
    Workbench.jsx          Runs any experiment: controls, clock, table, result
    Graph.jsx              Chart for readings, fit and response curve
  lib/
    router.jsx             Minimal hash router
    math.js                Fitting, peak finding, complex numbers, formatting
    parts.jsx              Drawing library: panels, LCDs, scope, schematic symbols
  sims/                    Experiment definitions, grouped by subject
```

## Adding or changing an experiment

Experiments are plain objects, added to a kit's array in `src/sims/`. `Workbench` runs them all the same way:

```js
{
  id: 'simple-pendulum',
  title: 'Simple pendulum',
  short: 'g from T² against L',          // card subtitle
  aim, formula, principle, steps,        // guide content
  controls: [num('L', 'Length', 0.2, 1, 0.05, 0.75, 'm')],
  out: (v, t) => ({ T: 2 * Math.PI * Math.sqrt(v.L / 9.78) }),  // the physics
  Stage: ({ v, o, t, set }) => <Svg>...</Svg>,                  // the apparatus
  read: (v, o) => [['Period', o.T.toFixed(3), 's']],            // live readouts
  columns: [['L', 'L (m)', 2], ['T2', 'T² (s²)', 3]],           // key, heading, decimals
  sample: (v, o) => ({ L: v.L, T2: o.T ** 2 }),                 // one recorded row
  sweep: { k: 'L', n: 9 },                                      // Auto-collect series
  graph: { x: 'L', y: 'T2', xl: 'L (m)', yl: 'T² (s²)', fit: true },
  analyse: (rows, v) => [['g', 9.78, 'm/s²', 9.78]],            // label, value, unit, expected
}
```

`columns`, `graph`, `sweep` and `analyse` are optional. A `sample` function can return `{ error: 'message' }` to refuse a reading, for example when an instrument is not yet balanced.

## Simulation notes

These are teaching models based on standard physics and the supplied specifications, not calibrated replicas of the hardware. Where the document does not give a value, typical textbook values are used.

- **Quincke's Method** covers both surface tension (from the title) and magnetic susceptibility (which the listed hardware is designed for).
- **Fermi energy** uses an effective lattice constant `Y·a = 36 N/m`.
- **Zeeman** treats the 546.1 nm line as a normal Zeeman triplet for simplicity.
- **LCR panel** follows the photo of the kit (0.01 µF, 0.1 µF, 750 Ω, 1 kΩ, 100 mH, 200 mH, up to 1 MHz, 10 V p-p), which differs from the Word file's 8 Vpp and 1/10/60 kHz ranges. Assumptions: a 600 Ω generator output, a 15 Ω inductor winding, printed links between adjacent sockets, and a meter that reads across R in series use and line current in parallel use.
- **Full Adder panel** follows the photo of the kit. The breadboard is drawn but not patchable. Assumptions: gate outputs of 3.4 V high and 0.2 V low, a common ground, Logic Output LEDs that stay off when unconnected, and clocks above 1 Hz shown as a dimmed LED because they switch too fast to see.
- **Network panel** follows the kit picture. Assumptions: each block's internal source is isolated from the others, V is 12 V in the Thevenin and maximum power blocks, the LOAD RL stepper values are added controls, the Tellegen bridge values (R1 and R4 = 1 kΩ, R2 and R3 = 2.2 kΩ, R5 = 1 kΩ) are not given in the picture, and the ammeter has a 0.1 Ω shunt.
- **Brewster panel** follows the kit picture. The laser is powered from the output unit, and the detector arm follows the reflected beam by default.
- **Regulated DC Power Supply** follows the single-channel 0–30 V, 0–3 A specification.

## Tech stack

React 19 and Vite 8, with one self-hosted font (Figtree, Latin subset). Routing is a small built-in hash router, and all the simulations and charts are hand-written SVG and canvas, so no routing, chart or graphics library is required.

## Performance

- The catalog pages load only kit names and images. Each kit's simulation code is fetched when one of its experiments is opened.
- `src/data/catalog.json` is generated from `src/data/kits.js` by `npm run catalog`, which also runs before `dev` and `build`.
- `public/thumbs/` holds a WebP image of each experiment. Replace these if a kit's drawing changes.
- Animations run at 30 frames a second and stop when they are scrolled out of view.
