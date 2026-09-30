import { ArrowUpRight, type LucideIcon } from 'lucide-react';
import { Link } from 'wouter';

export type GameCardProps = {
  title: string;
  description: string;
  cue: string;
  href: string;
  icon: LucideIcon;
  tone: 'teal' | 'blue' | 'sand' | 'ice';
  testId: string;
};

export function GameCard({ title, description, cue, href, icon: Icon, tone, testId }: GameCardProps) {
  return (
    <Link href={href} className={`gz-card gz-card--${tone}`} aria-label={`Play ${title}`} data-testid={testId}>
      <span className="gz-card-icon" aria-hidden="true"><Icon size={27} strokeWidth={1.8} /></span>
      <h3 className="gz-card-title">{title}</h3>
      <p className="gz-card-description">{description}</p>
      <span className="gz-card-foot">
        <span className="gz-card-cue">{cue}</span>
        <span className="gz-card-cta">Play <ArrowUpRight size={19} aria-hidden="true" /></span>
      </span>
    </Link>
  );
}