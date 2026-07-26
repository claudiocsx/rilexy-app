export interface CameraFilter {
  id: string;
  name: string;
  overlayColor: string;
  overlayOpacity: number;
  vignette: boolean;
  vignetteOpacity: number;
  saturation: number;
  warmth: number;
  contrast: number;
}

export const CAMERA_FILTERS: CameraFilter[] = [
  {
    id: 'none',
    name: 'Normal',
    overlayColor: 'transparent',
    overlayOpacity: 0,
    vignette: false,
    vignetteOpacity: 0,
    saturation: 1,
    warmth: 0,
    contrast: 1,
  },
  {
    id: 'quente',
    name: 'Quente',
    overlayColor: '#FF8C00',
    overlayOpacity: 0.12,
    vignette: true,
    vignetteOpacity: 0.25,
    saturation: 1.2,
    warmth: 0.15,
    contrast: 1.1,
  },
  {
    id: 'soft-rose',
    name: 'Soft Rose',
    overlayColor: '#FFB6C1',
    overlayOpacity: 0.15,
    vignette: true,
    vignetteOpacity: 0.2,
    saturation: 1.1,
    warmth: 0.08,
    contrast: 1.05,
  },
  {
    id: 'dourado',
    name: 'Dourado',
    overlayColor: '#DAA520',
    overlayOpacity: 0.1,
    vignette: true,
    vignetteOpacity: 0.3,
    saturation: 1.3,
    warmth: 0.2,
    contrast: 1.2,
  },
  {
    id: 'vintage',
    name: 'Vintage',
    overlayColor: '#8B7355',
    overlayOpacity: 0.18,
    vignette: true,
    vignetteOpacity: 0.35,
    saturation: 0.7,
    warmth: 0.12,
    contrast: 0.9,
  },
  {
    id: 'romantico',
    name: 'Romântico',
    overlayColor: '#FF69B4',
    overlayOpacity: 0.1,
    vignette: true,
    vignetteOpacity: 0.15,
    saturation: 1.15,
    warmth: 0.1,
    contrast: 1.0,
  },
  {
    id: 'noite',
    name: 'Noite',
    overlayColor: '#191970',
    overlayOpacity: 0.18,
    vignette: true,
    vignetteOpacity: 0.4,
    saturation: 1.0,
    warmth: -0.1,
    contrast: 1.3,
  },
  {
    id: 'seda',
    name: 'Seda',
    overlayColor: '#FFF5EE',
    overlayOpacity: 0.08,
    vignette: false,
    vignetteOpacity: 0,
    saturation: 0.9,
    warmth: 0.05,
    contrast: 0.85,
  },
];
