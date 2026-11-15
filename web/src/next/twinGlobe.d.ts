export interface TwinGlobePoint {
  fips: string;
  centroid: [number, number];
}
export interface TwinGlobeProps {
  origin: TwinGlobePoint | null;
  twins: TwinGlobePoint[];
  selected: string | null;
}
export type Project = (lonLat: [number, number]) => [number, number] | null;
export interface TwinGlobeHandle {
  update(next: Partial<TwinGlobeProps>, refit?: boolean): void;
  zoom(delta: number): void;
  destroy(): void;
}
export function hasWebGL(): boolean;
export function createTwinGlobe(
  parent: HTMLElement,
  opts: { onSelect: (fips: string | null) => void; onFrame: (project: Project) => void },
): TwinGlobeHandle;
