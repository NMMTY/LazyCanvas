export class LazyError extends Error {
  public message: string;

  public constructor(message: string) {
    super(message);
    this.message = `[LazyCanvas] [ERROR] ${message}`;
  }
}

export class LazyLog {
  public static log(type = "none", ...message: any): void {
    switch (type) {
      case "info":
        console.log("[LazyCanvas] [INFO]", ...message);
        break;
      case "warn":
        console.warn("[LazyCanvas] [WARN]", ...message);
        break;
      default:
        console.log(...message);
        break;
    }
  }
}

export const defaultArg = {
  wh(w?: number, h?: number): { width: number; height: number } {
    return { width: w || 0, height: h || 0 };
  },
  vl(vertical?: boolean, layer?: boolean): { vertical: boolean; layer: boolean } {
    return { vertical: vertical || false, layer: layer || false };
  },
};

/**
 * Rethrows the first of the errors collected while drawing a subtree; the others
 * are logged so they are not lost.
 */
export function throwFirst(errors: unknown[]): void {
  if (errors.length === 0) return;
  for (const extra of errors.slice(1)) {
    LazyLog.log("error", extra instanceof Error ? extra.message : String(extra));
  }
  throw errors[0];
}

/**
 * What drawing a layer gives back: nothing, when it was done at once, or a promise for a layer that has to wait
 * for something (an image, a pattern).
 *
 * An `async` function costs an object for its state and a promise on every call, however little it waits for, and a
 * frame draws thousands of layers. So the layers draw straight through when they can, and `await` is only paid
 * by those that need it.
 */
export type Later = void | Promise<void>;

/** Whether a result is a promise (as opposed to the nothing a layer gives back when it is done). */
export function isLater(value: unknown): value is Promise<void> {
  return (
    value !== undefined && value !== null && typeof (value as PromiseLike<void>).then === "function"
  );
}

/**
 * Runs `step` for each item in turn, waiting for a step that is not done at once. A step that fails does not
 * stop the others: its error goes to `errors`.
 *
 * @returns {Later} Nothing if every step was done at once, otherwise a promise for the rest.
 */
export function eachInOrder<T>(
  items: readonly T[],
  step: (item: T) => Later,
  errors: unknown[],
  from = 0,
): Later {
  for (let i = from; i < items.length; i++) {
    let result: Later;
    try {
      result = step(items[i]);
    } catch (error) {
      errors.push(error);
      continue;
    }
    if (isLater(result)) {
      const next = i + 1;
      return result
        .then(undefined, (error) => {
          errors.push(error);
        })
        .then(() => eachInOrder(items, step, errors, next));
    }
  }
}

/**
 * Hands a fill style to `use`, as soon as there is one: at once for a plain colour, after the promise for a
 * pattern.
 */
export function withFill<T>(fill: T, use: (resolved: Awaited<T>) => Later): Later {
  if (isLater(fill)) return (fill as Promise<Awaited<T>>).then(use);
  return use(fill as Awaited<T>);
}
