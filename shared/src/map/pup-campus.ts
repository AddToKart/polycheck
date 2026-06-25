export interface CampusBuilding {
  id: string
  name: string
  abbreviation: string
  center: [number, number]
  polygon: [number, number][]
}

export interface CampusConfig {
  name: string
  center: [number, number]
  zoom: number
  buildings: CampusBuilding[]
}

const PUP_SANTA_MARIA_CENTER: [number, number] = [120.9991, 14.8697]

const PUP_SANTA_MARIA_BUILDINGS: CampusBuilding[] = [
  {
    id: 'main-academic',
    name: 'Main Academic Building',
    abbreviation: 'MAB',
    center: [120.9991, 14.8697],
    polygon: [
      [120.9987, 14.8694],
      [120.9995, 14.8694],
      [120.9995, 14.8700],
      [120.9987, 14.8700],
      [120.9987, 14.8694],
    ],
  },
  {
    id: 'gymnasium',
    name: 'Gymnasium',
    abbreviation: 'GYM',
    center: [120.9995, 14.8702],
    polygon: [
      [120.9992, 14.8699],
      [120.9998, 14.8699],
      [120.9998, 14.8705],
      [120.9992, 14.8705],
      [120.9992, 14.8699],
    ],
  },
  {
    id: 'mini-library',
    name: 'Mini-Library / Learning Center',
    abbreviation: 'LIB',
    center: [120.9988, 14.8695],
    polygon: [
      [120.9986, 14.8694],
      [120.9990, 14.8694],
      [120.9990, 14.8697],
      [120.9986, 14.8697],
      [120.9986, 14.8694],
    ],
  },
  {
    id: 'avr',
    name: 'Audio-Visual Room',
    abbreviation: 'AVR',
    center: [120.9993, 14.8698],
    polygon: [
      [120.9991, 14.8697],
      [120.9995, 14.8697],
      [120.9995, 14.8699],
      [120.9991, 14.8699],
      [120.9991, 14.8697],
    ],
  },
  {
    id: 'hrm-mini-hotel',
    name: 'HRM Mini-Hotel',
    abbreviation: 'HRM',
    center: [120.9985, 14.8702],
    polygon: [
      [120.9983, 14.8700],
      [120.9987, 14.8700],
      [120.9987, 14.8704],
      [120.9983, 14.8704],
      [120.9983, 14.8700],
    ],
  },
  {
    id: 'interfaith-chapel',
    name: 'Interfaith Chapel',
    abbreviation: 'CHAP',
    center: [120.9990, 14.8705],
    polygon: [
      [120.9988, 14.8704],
      [120.9992, 14.8704],
      [120.9992, 14.8706],
      [120.9988, 14.8706],
      [120.9988, 14.8704],
    ],
  },
  {
    id: 'admin-office',
    name: 'Admin Office',
    abbreviation: 'ADM',
    center: [120.9994, 14.8694],
    polygon: [
      [120.9992, 14.8693],
      [120.9996, 14.8693],
      [120.9996, 14.8695],
      [120.9992, 14.8695],
      [120.9992, 14.8693],
    ],
  },
  {
    id: 'open-quad',
    name: 'Open Quadrangle',
    abbreviation: 'QUAD',
    center: [120.9989, 14.8699],
    polygon: [
      [120.9987, 14.8697],
      [120.9991, 14.8697],
      [120.9991, 14.8700],
      [120.9987, 14.8700],
      [120.9987, 14.8697],
    ],
  },
]

export const pupSantaMaria: CampusConfig = {
  name: 'PUP Santa Maria, Bulacan Campus',
  center: PUP_SANTA_MARIA_CENTER,
  zoom: 17,
  buildings: PUP_SANTA_MARIA_BUILDINGS,
}
