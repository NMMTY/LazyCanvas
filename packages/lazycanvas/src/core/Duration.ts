/**
 * How long animations are, when that is known.
 *
 * A generator cannot be asked how long it will run, but the ones LazyCanvas creates
 * (`signal.to`, `signal.spring`, `signal.keyframes`, `waitFor`, `all`, `chain`, …) know it
 * when they are made. It is kept next to the generator, so a {@link Timeline} can place
 * something "half a second after the previous one ends".
 */
const durations = new WeakMap<object, number>();

/**
 * Remembers the length of an animation, in seconds.
 * @returns {T} The same generator.
 */
export function withDuration<T extends object>(animation: T, seconds: number): T {
  durations.set(animation, seconds);
  return animation;
}

/**
 * The length of an animation in seconds, or `undefined` if it is not known
 * (a generator written by hand, or one that loops forever).
 */
export function durationOf(animation: object): number | undefined {
  return durations.get(animation);
}
