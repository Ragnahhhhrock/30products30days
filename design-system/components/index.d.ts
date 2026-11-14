export interface ButtonProps { variant?: 'primary' | 'secondary'; href?: string; type?: 'button' | 'submit'; disabled?: boolean; onClick?: () => void; children: any; }
export interface TagProps { status?: 'shipped' | 'building' | 'planned'; children?: any; }
export interface DayBadgeProps { day?: number; size?: number; }
export interface ProductCardProps { day: number; type?: string; title: string; description: string; price: string; cta?: string; href?: string; }
export interface ProgressBarProps { done: number; total?: number; }
