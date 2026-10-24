/**
 * Cheil fork: the build carries the upstream's release feed, and updating
 * from it would replace this app with the upstream product. Until the fork
 * has a feed of its own, a new version is handed out as a new installer, so
 * the packaged app never checks for updates. A function, so the upstream's
 * updater tests can still exercise the feed path with this module mocked.
 */
export function cheilUpdateFeedOff(): boolean {
  return true
}
