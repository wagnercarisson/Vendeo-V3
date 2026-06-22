> **Purpose**: Shared color probe module extracted by mechanical refactoring from `brand-director.ts` — provides pixel-level color extraction with 150×150 resize, 32px RGB bucket quantization, average-color-per-bucket, role classification heuristics, and deltaE utilities. Consumed by both brand-director (logo flow) and brand-profiler (visual signature flow). Pure extraction — no logic changes.

## Requirements

### Requirement: ColorProbe module — mechanical extraction

The system SHALL have a shared module at `src/lib/brand-assets/color-probe.ts` created by mechanically extracting the following from `brand-director.ts` without altering any logic:

**Exports SHALL include:**
- `probeColors(buffer: Buffer): Promise<ColorProbeResult>` — extracts and classifies colors from image buffer at 150×150 resolution
- `ColorProbeResult` — interface with `dominant_pixels`, `dark_ink_candidates`, `neutral_candidates`, `background_candidates`, `small_but_structural`, `suspected_transitions` (each `ColorCluster[]`)
- `ColorCluster` — interface with `hex`, `rgb`, `lab`, `frequency`, `luminance`, `saturation`, `edgeRatio`, `classification`
- `deltaE(lab1: [number, number, number], lab2: [number, number, number]): number` — CIE76 Euclidean distance in LAB space
- `hexToLab(hex: string): [number, number, number]`
- `rgbToHex(r: number, g: number, b: number): string`
- `findClosestProbeCluster(hex: string, clusters: ColorCluster[]): { cluster: ColorCluster | null; deltaE: number }`
- `isLightNeutral(hex: string): boolean`
- Constants: `STRONG_MATCH_DELTA_E = 12`, `ACCEPTABLE_MATCH_DELTA_E = 18`, `LOOSE_MATCH_DELTA_E = 25`

`brand-director.ts` SHALL import these from `color-probe.ts` instead of defining them locally. `curateLogoColors` and `applyGuardrail` SHALL NOT be modified.

#### Scenario: Module exports match existing API

- **WHEN** importing every symbol from `color-probe.ts`
- **THEN** every symbol listed above SHALL be exported
- **AND** the extraction SHALL be purely mechanical — function signatures SHALL match original `brand-director.ts` exactly, with the sole exception of the added `edgeRatio` field on `ColorCluster` (exposes already-calculated data without changing classification logic)
- **AND** `brand-director.ts` SHALL compile without errors after importing from `color-probe.ts`

### Requirement: probeColors implementation

`probeColors(buffer: Buffer)` SHALL implement the existing algorithm:

1. Resize image to **150×150** with `fit: 'cover'` and `flatten({ background: '#FFFFFF' })`
2. Extract raw RGBA pixel data via Sharp
3. Quantize each pixel into **32px buckets**: `key = round(r/32)*32, round(g/32)*32, round(b/32)*32`
4. For each bucket, track: pixel count, sum of RGB values (for average computation), and edge pixel count (row 0/149 or col 0/149)
5. Compute average hex per bucket: `avgR = sumR / count`, `avgG = sumG / count`, `avgB = sumB / count`
6. Compute `frequency = count / totalPixels`, `luminance`, `saturation`, and `edgeRatio = edgeCount / count`
7. Sort all entries by frequency descending
8. Consolidate clusters: merge entries where `deltaE(lab1, lab2) <= 12`, keeping the higher-frequency one
9. Classify each consolidated cluster into **one of 6 roles**:
   - `background` — cluster with highest edgeRatio that is not a chromatic brand field
   - `dark_ink` — luminance < 0.25
   - `neutral` — saturation < 0.1 (excluding light-on-dark structural candidates)
   - `structural` — high contrast from background, small area, or saturation > 0.3 with frequency < 0.03
   - `transition/artifact` — very small clusters (frequency < 0.005), interpolation artifacts, or clusters too close to background
   - `dominant` — remaining significant clusters
10. Return `ColorProbeResult` with the 6 classified arrays

#### Scenario: Probe produces expected output structure

- **WHEN** `probeColors` receives a valid 1080×1080 PNG buffer
- **THEN** it SHALL return a `ColorProbeResult` with all 6 arrays
- **AND** `dominant_pixels` length + `dark_ink_candidates` length + `neutral_candidates` length + `background_candidates` length + `small_but_structural` length + `suspected_transitions` length SHALL equal the number of consolidated clusters

#### Scenario: Probe handles error gracefully

- **WHEN** `probeColors` receives an invalid buffer
- **THEN** it SHALL return `{ dominant_pixels: [], dark_ink_candidates: [], neutral_candidates: [], background_candidates: [], small_but_structural: [], suspected_transitions: [] }`
- **AND** it SHALL NOT throw

### Requirement: findClosestProbeCluster behavior

`findClosestProbeCluster(hex, clusters)` SHALL:
- Convert input `hex` to LAB
- Compute `deltaE` against each cluster's LAB
- Return the cluster with the minimum ∆E and the computed ∆E value
- Return `{ cluster: null, deltaE: Infinity }` if `clusters` is empty

#### Scenario: Finds closest cluster

- **WHEN** `findClosestProbeCluster('#22C55E', clusters)` is called with non-empty clusters
- **THEN** it SHALL return the cluster with minimum ∆E
- **AND** `deltaE` SHALL be >= 0

#### Scenario: Returns null cluster for empty clusters

- **WHEN** `findClosestProbeCluster('#22C55E', [])` is called
- **THEN** `cluster` SHALL be `null`
- **AND** `deltaE` SHALL be `Infinity`