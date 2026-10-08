import type { WeatherType } from '@reveil/core';

/** Morceau de la playlist locale de secours, associé à la météo pour laquelle il est choisi. */
export interface LocalTrackEntry {
  readonly weather: WeatherType;
  readonly title: string;
  readonly artist: string;
}

/** Playlist codée en dur : au moins un morceau par météo, disponible sans réseau. */
export const LOCAL_TRACKS: ReadonlyArray<LocalTrackEntry> = [
  { weather: 'SOLEIL', title: 'Here Comes the Sun', artist: 'The Beatles' },
  { weather: 'SOLEIL', title: 'Walking on Sunshine', artist: 'Katrina and the Waves' },
  { weather: 'PLUIE', title: "Singin' in the Rain", artist: 'Gene Kelly' },
  { weather: 'PLUIE', title: 'Purple Rain', artist: 'Prince' },
  { weather: 'NEIGE', title: 'Let It Snow! Let It Snow! Let It Snow!', artist: 'Dean Martin' },
  { weather: 'NEIGE', title: 'Tombe la neige', artist: 'Salvatore Adamo' },
  { weather: 'NUAGEUX', title: 'Both Sides Now', artist: 'Joni Mitchell' },
  { weather: 'NUAGEUX', title: 'Get Off of My Cloud', artist: 'The Rolling Stones' },
];
