# Honeywell Technologies Virtual Laboratory

An interactive virtual laboratory for the sample items in `Specs_33_Sample_Items_Print.docx`. It is built with React, Vite and three.js, uses a light-only theme in the Honeywell Technologies red and white, and runs every kit as an interactive 3D simulation.

There are **31 kits** and **101 experiments**. The Raspberry Pi 5 and FPGA kits from the Word file have been removed.

The site works in three steps:

1. **Kits.** Every kit appears as a card with an image of its 3D model. Search, or filter by discipline and level (UG Lab, PG Lab, Equipment).
2. **Experiments.** Selecting a kit lists its experiments, with the full specification from the Word file.
3. **Simulation.** Selecting an experiment opens the 3D model of the kit, set up for that experiment.

## Getting started

Requires Node.js 20 or newer.

```bash
npm install
npm run dev       # development server, usually http://localhost:5173
npm run build     # production build in dist/
npm run preview   # serve the production build
```

The build uses relative paths and hash routing, so `dist/` can be hosted from any static server or sub-folder without extra configuration.

## The simulation page

| Area | Description |
| --- | --- |
| 3D kit | The kit on a lab bench. Drag the background to look around, and use the view buttons to jump to the instruments. Knobs, switches, keys, sockets and patch cords on the model all work. |
| Controls | A column beside the simulation with the same settings as sliders and selectors, plus **Record reading** and **Auto-collect**. On narrow screens it moves below the simulation. |
| Live readings | The values the kit's own displays and meters show. |
| Corner windows | Oscilloscope traces, eyepiece views, camera images and data logger plots, drawn live. |
| Particle view | A canvas showing what happens inside the apparatus: electrons in a conductor, charge on a capacitor, holes in a Hall crystal, neon atoms being excited, photons, magnetic moments and more. |
| Guide | Aim, principle, formula and a procedure you can tick off. |
| Observations | Readings recorded one at a time or by Auto-collect, exportable to CSV. |
| Graph | Readings, best-fit line, the kit's response curve and a live marker. |
| Result | The calculated answer, compared with the expected value as a percentage difference. |

Readings include a small random scatter so results behave like real measurements. The simulation can be paused or run at ¼× and 3×.

Each kit also refuses a reading when the apparatus is not ready, as the real one would. Examples include a switched-off supply, an unplugged cord, an untuned control, unfocused rings or a drop that is not yet balanced.

## The 3D kits

Each model is built from the reference picture of the kit, with its front panels drawn in the picture's own layout.

| Code | Kit | What you can operate |
| --- | --- | --- |
| PhyUGEx-2 | Bar Pendulum | Release the bar or bob, re-hang the bar from any hole, and use the photogate, stop clock and counter. |
| PhyUGEx-11 | Coupled Oscillator | Release either pendulum, slide the spring clamps, and read the data unit's LCD and bar graph. |
| PhyUGEx-35 | Air Wedge | Drag the micrometer drum of the travelling microscope, change the wedge object, and work the spherometer screw. Live eyepiece view. |
| PhyUGEx-44 | Network Theorems Trainer | The full wireable panel in a 3D case, with patch cords, pots, supplies and meters. |
| PhyUGEx-48, PhyPGEx-18 | Brewster's Law | Turn the goniometer table, polarizer wheel and detector arm. ZERO, GAIN and POWER work on the output unit. |
| PhyUGEx-61 | Series and Parallel LCR | The full wireable panel in a 3D case, with generator keys and knobs. |
| PhyUGEx-74 | Thomson e/m | Slide the bar magnets and set the deflection voltage. The spot moves on the CRT. |
| PhyUGEx-80 | Michelson Interferometer | Coarse drum, fine micrometer and M2 tilt screws, with live fringes in the telescope. |
| PhyPGEx-20 | Refractive Index of Thin Glass | The same interferometer with a glass sheet on a rotating stage in the M1 arm. |
| PhyUGEx-98 | Hall Effect | Electromagnet, Ge crystal with oven, InAs probe, and three working instruments. |
| PhyUGEx-101 | Fermi Energy of Copper | Kettle heating, probe thermometer and the constant current unit. |
| PhyUGEx-105 | Dielectric Constant | Capacitance meter, liquid cell and micrometer plates. |
| PhyUGEx-107 | B–H Curve | Curve tracer and oscilloscope with the live loop. |
| PhyPGEx-62 | B–H Curve: Hard and Soft | U–I core with coils, sensors and logger. A DRIVE knob sets the field and a swappable spare I-core changes the material. |
| PhyUGEx-161 | Quincke's Method | Travelling microscope with live eyepiece, and the magnet supply. |
| PhyUGEx-201 | Angstrom's Method | The heat wave moves along the copper rod, with four thermocouple readings. |
| PhyUGEx-214 | Faraday's Law | Drop the magnet through the coil in slow motion. A data logger window plots the EMF pulse. |
| PhyUGEx-250 | Seebeck and Peltier Effect | Heat sinks change colour with temperature, and swapping the leads reverses the heat flow. |
| PhyUGEx-256, PhyPGEx-17 | Franck–Hertz | Neon tube with orange glow layers, four knobs, MODE keys, sensors and logger. |
| PhyUGEx-262 | Lissajous Figures | Sloped trainer and CRO with draggable patch cords and a live X-Y display. |
| PhyUGEx-268 | Operational Amplifier Trainer | Modelled on the real black panel: ±5 V, ±12 V and variable supplies, resistor, diode and capacitor banks, two µA741 sockets, breadboard, function generator and eight pots. Click a generator OUTPUT socket for sine, square or triangle, and drag the ringed plugs between banks. |
| PhyUGEq-1 | Dual Regulated DC Power Supply | Working keypad, encoder, STEP, CH A/B, OUTPUT and POWER. Channel A drives a rheostat and channel B a 4.9 Ω resistor. |
| PhyUGEx-242 | Full Adder and Subtractor | The full wireable logic panel in a 3D case, with input switches, LEDs and displays. |
| PhyPGEx-32 | Ultrasonic Interferometer | Liquid cell with micrometer and standing waves, analogue µA meter and 1/2/3 MHz keys. The distance unit has transducers and a draggable target. |
| PhyPGEx-61 | Curie Temperature | Kettle heating, probe thermometer with HOLD, and the two-display kit unit. |
| PhyPGEx-103 | Zeeman Effect | Electromagnet with Hg lamp, optical bench with a movable L2 lens, polarizer, power supply and Gauss meter. A camera window shows the rings. |
| PhyPGEx-114 | Millikan's Oil Drop | Atomizer, field plates, LED, voltage knob, FIELD REVERSE, stop clock and a monitor with the tracked drop. |
| EleEq-37 | AM Modulation & Demodulation Trainer | The real green trainer board on a wooden stand: AF, RF and audio pre-amp generators, three balanced modulators, a balanced demodulator, SSB block, 1 MHz power and pre amplifiers, 455 kHz and 1 MHz band-pass filters and an audio power amplifier. Blue preset trimmers, SW1 carrier select, FAULT SW2 with 8 faults, block status LEDs, a telescopic antenna and live patch cords. |
| EleEq-47 | Fiber Optic Trainer | Modelled on the real black panel: two emitters and two detectors joined by the fibre, FM and PWM modulators, comparators, filters, PLL, AC amplifiers and audio output. Click an emitter for 660 or 950 nm, use the SW3 and SW4 fault switches, and read results on a bench multimeter. |

The Network Theorems, LCR and Full Adder panels are the original wireable panels shown inside a 3D instrument case with `CSS3DRenderer`, so every socket, cord and switch keeps working. Wiring is most accurate from the Front view.

## Kits and experiments

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
| EleEq-37 | AM Modulation & Demodulation Trainer | 5 |
| EleEq-47 | Fiber Optic Trainer | 8 |

Where the Word file lists functional or experimental capabilities, those became the experiments. Where it gives only a title and a hardware list, experiments were chosen to fit that hardware.

## Project structure

```
src/
  main.jsx, App.jsx        Entry point and routes
  styles.css               Design tokens and all styling (light theme only)
  assets/                  Self-hosted fonts (Abril for headings, Figtree for text)
  data/
    specs.json             Specifications extracted from the Word file
    kits.js                Source list of kits, used to generate catalog.json
    catalog.js             Kit names and experiment titles for the catalog pages
    sims.js                Loads each kit's 3D simulation on demand
  pages/                   Home (hero and kits), Kit (experiments), Experiment (simulation)
  components/
    Workbench.jsx          Runs any experiment: controls, clock, readings, table, result
    Graph.jsx              Chart for readings, fit and response curve
    Micro.jsx              Particle views
  lib/
    router.jsx             Minimal hash router
    math.js                Fitting, peak finding, complex numbers, formatting
    parts.jsx              SVG drawing library used by the panels and fallbacks
  sims/
    electrical.jsx, optics.jsx, magnetism.jsx, thermal.jsx, modern.jsx, comm.jsx, mechanics.jsx
                           The physics and experiment definitions, grouped by subject
    studio3d.js            Shared renderer, lighting, camera and canvas textures
    kit3d.jsx              Shared 3D toolkit: bench, instrument units, knobs, sockets,
                           seven-segment displays, pointer handling and the React stage
    panel3d.jsx            Puts a wireable SVG panel inside a 3D case (CSS3DRenderer)
    *3d.jsx                One file per 3D kit, for example millikan3d.jsx or am3d.jsx
    lcrpanel.jsx, networkpanel.jsx, adderpanel.jsx, brewsterpanel.jsx
                           The wireable panels and the Brewster panel logic
    micromap.js            Connects each experiment to its particle view
scripts/catalog.mjs        Builds src/data/catalog.json before dev and build
public/thumbs/             A WebP image of each experiment, taken from its 3D model
```

## Adding or changing an experiment

Experiments are plain objects in a kit's array in `src/sims/`, and `Workbench` runs them all the same way:

```js
{
  id: 'simple-pendulum',
  title: 'Simple pendulum',
  short: 'g from T² against L',          // card subtitle
  aim, formula, principle, steps,        // guide content
  controls: [num('L', 'Length', 0.2, 1, 0.05, 0.75, 'm')],
  out: (v, t) => ({ T: 2 * Math.PI * Math.sqrt(v.L / 9.78) }),  // the physics
  Stage: ({ v, o, t, set }) => <Svg>...</Svg>,                  // flat fallback drawing
  read: (v, o) => [['Period', o.T.toFixed(3), 's']],            // live readouts
  columns: [['L', 'L (m)', 2], ['T2', 'T² (s²)', 3]],           // key, heading, decimals
  sample: (v, o) => ({ L: v.L, T2: o.T ** 2 }),                 // one recorded row
  sweep: { k: 'L', n: 9 },                                      // Auto-collect series
  graph: { x: 'L', y: 'T2', xl: 'L (m)', yl: 'T² (s²)', fit: true },
  analyse: (rows, v) => [['g', 9.78, 'm/s²', 9.78]],            // label, value, unit, expected
}
```

`columns`, `graph`, `sweep` and `analyse` are optional. A `sample` function can return `{ error: 'message' }` to refuse a reading.

A 3D kit wraps those experiments without changing their physics, as in `src/sims/curie3d.jsx`:

```js
export const curie3D = curieKit.map((e) => ({
  ...e,
  wide: true,                                  // stage beside the controls column
  state: () => ({ pwr: true, cP: true }),      // extra switches that live only on the model
  sample: (v, o) => (v.pwr ? e.sample(v, o) : { error: 'The kit is off. Press POWER.' }),
  Stage: stage3D(e, (host, api) => build(host, api, e), { labels, hint }),
}))
```

`build` uses `kitScene` from `kit3d.jsx` to make the bench, `unit()` to add an instrument whose front panel is drawn in the reference picture's coordinates, and `listen()` to wire its knobs, keys and sockets to `api.set`. If WebGL is not available, the stage falls back to the flat `Stage` drawing.

After changing a model, regenerate its card image in `public/thumbs/<kit-id>-<experiment-id>.webp`.

## Simulation notes

These are teaching models based on standard physics and the supplied specifications, not calibrated replicas of the hardware. Where the document gives no value, typical textbook values are used.

- **Quincke's Method** covers both surface tension (from the title) and magnetic susceptibility (which the listed hardware is designed for).
- **Fermi energy** uses an effective lattice constant `Y·a = 36 N/m`.
- **Zeeman** treats the 546.1 nm line as a normal Zeeman triplet. The supply's V knob limits the magnet current through a 5 Ω coil.
- **Franck–Hertz:** the CONTROL G1 knob changes its own display only.
- **Lissajous RLC network** uses 1 kΩ, 100 mH and 0.01 µF as printed on the trainer, so resonance is 5.03 kHz. AMPL and the CRO knobs change the trace size and position, not the readings.
- **Operational amplifier:** the variable supplies are labelled V₁ and V₂ and run from −5 to +5 V, the range the experiments use, rather than the printed +1.5…+10 V and −1.5…−10 V. Each circuit comes pre-wired, and only the ringed resistor and capacitor plugs and the supply cords move.
- **Dual DC supply:** channel B can be set from the keypad, but readings and Record use channel A.
- **Curie temperature** reads the secondary in mV to match the kit display.
- **Ultrasonic interferometer** offers 1, 2 and 3 MHz crystals, and FREQ ADJ must be at the centre to record.
- **AM trainer:** a single board, with no superheterodyne receiver. The face is the bench board drawing rendered to `src/sims/am-board.webp`. Click the supply LEDs to switch it on and off. FAULT SW2 sets faults F1–F8. SW1 must be at 1M for the DSB experiments and at 455k for SSB. SSB demodulation uses the board's balanced demodulator; the recovered tone is the sent tone plus the carrier offset.
- **LCR panel** follows the photo of the kit (0.01 µF, 0.1 µF, 750 Ω, 1 kΩ, 100 mH, 200 mH, up to 1 MHz, 10 V p-p), which differs from the Word file's 8 Vpp and 1/10/60 kHz ranges. It assumes a 600 Ω generator output, a 15 Ω inductor winding, printed links between adjacent sockets, and a meter across R in series use and in the line in parallel use.
- **Full Adder panel** follows the photo. The breadboard is drawn but not patchable. Gate outputs are 3.4 V high and 0.2 V low, and clocks above 1 Hz show as a dimmed LED.
- **Network panel** follows the kit picture. Each block's internal source is isolated, V is 12 V in the Thevenin and maximum power blocks, the LOAD RL stepper values are added controls, the Tellegen bridge values are assumed, and the ammeter has a 0.1 Ω shunt.

## Design

- Honeywell Technologies red (`#e20001`) on white, with Abril headings and Figtree text.
- The home page hero is a full-screen photograph of a lab bench (`public/hero-lab.webp`, with a smaller version for phones) behind the headline.
- Every 3D scene uses the same light bench and wall, so all kits match the site theme.
- View buttons, corner windows and cards share the red accent, rounded corners and soft shadows.

## Tech stack

- React 19 and Vite 8.
- three.js for the 3D kits, including `OrbitControls`, `RoomEnvironment` and `CSS3DRenderer`.
- A small built-in hash router.
- Hand-written SVG and canvas for charts, panels, displays and particle views.
- No routing, chart or UI library.

## Performance

- The catalog pages load only kit names and images. A kit's 3D model and physics are fetched when one of its experiments is opened.
- three.js loads only on a simulation page. Each kit's own code is typically 6 to 30 kB compressed.
- Each 3D scene renders only when something changes, frees its GPU resources when you leave the page, and stops animating when scrolled out of view.
- `src/data/catalog.json` is generated from `src/data/kits.js` by `npm run catalog`, which also runs before `dev` and `build`.

## Testing

All experiments were run automatically against the production build, recording a full Auto-collect series in each. All of them completed without page errors, and every computed result was within 5% of its expected value. Pages were also checked at phone width for horizontal overflow. The automated runs used software (SwiftShader) graphics in headless Chrome. Real browsers with a graphics card render the scenes much faster.
