export type ProcessingStatus = 'pending' | 'processing' | 'done' | 'error';
export type ProcessingMode = 'full' | 'partial-wall' | 'turntable-tint' | 'tint-turntable-only';
export type FloorEffect = 'none' | 'desaturate' | 'red' | 'yellow';
export type TurntableTint = 'none' | 'red' | 'yellow';

export interface ProcessingOptions {
  floorEffect: FloorEffect;
  matchReflections: boolean;
  turntableTint: TurntableTint;
}

export interface ProcessedImage {
  id: string;
  originalFile: File;
  originalUrl: string;
  processedUrl: string | null;
  status: ProcessingStatus;
  error?: string;
}
