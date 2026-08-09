export const CATEGORIES = [
  { id: 'reinforcement-learning', title: 'Reinforcement Learning', short: 'RL' },
  { id: 'llms', title: 'LLMs', short: 'LLM' },
  { id: 'generative-modeling', title: 'Generative Modeling', short: 'GEN' },
  { id: 'applied-ml', title: 'Applied ML', short: 'APP' },
  { id: 'general-ml', title: 'General ML', short: 'ML' },
  { id: 'linear-algebra', title: 'Linear Algebra', short: 'LA' },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]['id'];

export const CATEGORY_TITLE: Record<string, string> = Object.fromEntries(CATEGORIES.map(category => [category.id, category.title]));
