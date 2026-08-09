const GREEK: Record<string, string> = {
  'α': '\\alpha',
  'β': '\\beta',
  'γ': '\\gamma',
  'δ': '\\delta',
  'ε': '\\epsilon',
  'θ': '\\theta',
  'λ': '\\lambda',
  'μ': '\\mu',
  'π': '\\pi',
  'σ': '\\sigma',
  'τ': '\\tau',
  'φ': '\\phi',
  'ψ': '\\psi',
  'ω': '\\omega',
  'Σ': '\\sum',
  'Π': '\\prod',
  '∇': '\\nabla',
  '∂': '\\partial',
  '∞': '\\infty',
  '≈': '\\approx',
  '≤': '\\le',
  '≥': '\\ge',
  '≠': '\\ne',
  '×': '\\times',
  '·': '\\cdot',
  '→': '\\to',
};

const ALIASES: Array<[RegExp, string]> = [
  [/\\dfrac|\\tfrac/g, '\\frac'],
  [/\\mathbb\s*\{?E\}?/g, 'E'],
  [/\\operatorname\s*\{([^}]*)\}/g, '$1'],
  [/\\mathrm\s*\{([^}]*)\}/g, '$1'],
  [/\\text\s*\{([^}]*)\}/g, '$1'],
  [/\\left|\\right/g, ''],
  [/\\!|\\,|\\;|\\:|\\quad|\\qquad|~/g, ''],
  [/\\hat\s*\{([^}]*)\}/g, '\\hat $1'],
  [/\\big[lr]?|\\Big[lr]?|\\bigg[lr]?/g, ''],
  [/\\limits/g, ''],
  [/\\cdot/g, '*'],
  [/\\times/g, '*'],
  [/\bE_\{?([a-zA-Z0-9\\,~]+)\}?/g, 'E[$1]'],
];

export function normaliseLatex(input: string): string {
  let value = input.trim();
  value = value.replace(/^\$+|\$+$/g, '');
  value = value.replace(/\\begin\{[a-z*]+\}|\\end\{[a-z*]+\}/g, '');
  for (const [from, to] of Object.entries(GREEK)) value = value.split(from).join(to);
  for (const [pattern, replacement] of ALIASES) value = value.replace(pattern, replacement);
  value = value.replace(/\s+/g, '');
  value = value.replace(/\{([A-Za-z0-9])\}/g, '$1');
  return value.toLowerCase();
}

export function normaliseText(input: string) {
  return input.toLowerCase().replace(/[`*_]/g, '').replace(/\s+/g, ' ').trim();
}

export function normaliseCode(input: string) {
  return input
    .replace(/#.*$/gm, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([(),+\-*/=<>\[\]])\s*/g, '$1')
    .trim();
}
