// createLimiter returns a gate that runs at most n async tasks concurrently.
// Extra calls queue and start as slots free. Keeps the client gentle on the
// single Patu node without pulling in a dependency.
export function createLimiter(n: number): <T>(fn: () => Promise<T>) => Promise<T> {
  let active = 0;
  const queue: Array<() => void> = [];
  const next = () => {
    if (active >= n || queue.length === 0) return;
    active++;
    queue.shift()!();
  };
  return <T>(fn: () => Promise<T>) =>
    new Promise<T>((resolve, reject) => {
      queue.push(() => {
        fn().then(resolve, reject).finally(() => {
          active--;
          next();
        });
      });
      next();
    });
}
