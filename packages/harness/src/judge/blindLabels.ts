export interface LabeledItem<T> {
  label: string;
  item: T;
}

/** A, B, C, ... Z, AA, AB, ... — spreadsheet-style, so more than 26 runs never collide. */
function labelFor(index: number): string {
  let n = index;
  let label = '';
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

/** Fisher-Yates shuffle before labelling, so label order carries no information about run order. */
export function assignBlindLabels<T>(
  items: T[],
  random: () => number = Math.random,
): LabeledItem<T>[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const temp = shuffled[i] as T;
    shuffled[i] = shuffled[j] as T;
    shuffled[j] = temp;
  }
  return shuffled.map((item, index) => ({ label: labelFor(index), item }));
}
