import { QuizLauncherClient } from '@/components/quiz/QuizLauncherClient';

export const metadata = {
  title: 'Quiz',
  description: 'Build a quiz session from concepts, categories, weak spots, or the due queue.',
};

export default function QuizPage() {
  return <QuizLauncherClient />;
}
