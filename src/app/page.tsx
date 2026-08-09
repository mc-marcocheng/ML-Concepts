import { ConceptIndex } from '@/components/concepts/ConceptIndex';
import { listConcepts } from '@/lib/content/server';

export const metadata = {
  title: 'Concepts',
  description: 'Grouped machine-learning concept notes, quizzes, and review progress.',
};

export default async function HomePage() {
  const concepts = await listConcepts();
  return <ConceptIndex concepts={concepts} />;
}
