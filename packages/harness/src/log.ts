/**
 * The CLI's only output layer. Every other module returns data instead of printing, so this is
 * the one place `console` is allowed.
 */
export const log = {
  info(message: string): void {
    console.log(message);
  },
  warn(message: string): void {
    console.warn(message);
  },
  error(message: string): void {
    console.error(message);
  },
};
