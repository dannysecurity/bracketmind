export interface ColorOptions {
  enabled: boolean;
}

export const ansi = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

export function winner(text: string, options: ColorOptions): string {
  if (!options.enabled) {
    return text;
  }
  return `${ansi.bold}${ansi.green}${text}${ansi.reset}`;
}

export function dim(text: string, options: ColorOptions): string {
  if (!options.enabled) {
    return text;
  }
  return `${ansi.dim}${ansi.gray}${text}${ansi.reset}`;
}

export function heading(text: string, options: ColorOptions): string {
  if (!options.enabled) {
    return text;
  }
  return `${ansi.bold}${ansi.cyan}${text}${ansi.reset}`;
}

export function bar(filled: string, empty: string, options: ColorOptions): string {
  if (!options.enabled) {
    return filled + empty;
  }
  return `${ansi.green}${filled}${ansi.reset}${ansi.dim}${empty}${ansi.reset}`;
}
