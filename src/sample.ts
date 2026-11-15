/** Result of a single fully completed download. */
export interface Sample {
  /** Number of response body bytes actually received. */
  readonly bytes: number;
  /** Time from sending the request until the last body byte was received. */
  readonly durationMs: number;
}
