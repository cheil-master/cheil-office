/** Cheil fork: Pinterest sessions never cross the main-process boundary. */
export interface PinterestBoard {
  id: string
  name: string
  url: string
  count: number
}
export interface PinterestPin {
  id: string
  title: string
  image: string
}
export interface PinterestState {
  connected: boolean
  boards?: PinterestBoard[]
  pins?: PinterestPin[]
  style?: {
    profile: import('./cheil-style-api').DocumentStyle
    selection: import('./cheil-style-api').StyleSelection
  }
  references?: { board: PinterestBoard; pins: PinterestPin[] }
  more?: boolean
  error?: 'login' | 'failed' | 'changed' | 'busy'
}
export interface PinterestRequest {
  op: 'pinterest'
  action:
    | 'status'
    | 'connect'
    | 'disconnect'
    | 'boards'
    | 'pins'
    | 'more'
    | 'style'
    | 'reference'
    | 'references'
  pins?: string[]
  pin?: string
  board?: string
}
