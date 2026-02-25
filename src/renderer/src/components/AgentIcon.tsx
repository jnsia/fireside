interface IconProps {
  size?: number
  color?: string
}

const s = { fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, strokeWidth: 1.6 }

export function PlannerIcon({ size = 20, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <rect x="3.5" y="2" width="13" height="16" rx="1.5" stroke={color} {...s} />
      <line x1="6.5" y1="7"  x2="13.5" y2="7"  stroke={color} {...s} />
      <line x1="6.5" y1="10" x2="13.5" y2="10" stroke={color} {...s} />
      <line x1="6.5" y1="13" x2="10.5" y2="13" stroke={color} {...s} />
    </svg>
  )
}

export function DesignerIcon({ size = 20, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M4 15.5 C4 15.5 6 13 10 10 C14 7 16 4.5 16 4.5" stroke={color} {...s} />
      <circle cx="10" cy="10" r="1.5" fill={color} />
      <circle cx="4.5"  cy="15.5" r="1.5" stroke={color} {...s} />
      <circle cx="15.5" cy="4.5"  r="1.5" stroke={color} {...s} />
    </svg>
  )
}

export function DeveloperIcon({ size = 20, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M7.5 7 L4 10 L7.5 13" stroke={color} {...s} />
      <path d="M12.5 7 L16 10 L12.5 13" stroke={color} {...s} />
      <line x1="11" y1="6" x2="9" y2="14" stroke={color} {...s} />
    </svg>
  )
}

export function QAIcon({ size = 20, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle cx="8.5" cy="8.5" r="5" stroke={color} {...s} />
      <line x1="12.5" y1="12.5" x2="16.5" y2="16.5" stroke={color} {...s} />
    </svg>
  )
}

export function MentorIcon({ size = 20, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M10 3 C7 3 5 5.5 5 8 C5 10 6.5 11.5 7.5 12.5 L7.5 14 L12.5 14 L12.5 12.5 C13.5 11.5 15 10 15 8 C15 5.5 13 3 10 3Z" stroke={color} {...s} />
      <line x1="7.5" y1="15.5" x2="12.5" y2="15.5" stroke={color} {...s} />
      <line x1="8.5" y1="17"   x2="11.5" y2="17"   stroke={color} {...s} />
    </svg>
  )
}

export const AGENT_ICONS = {
  planner:   PlannerIcon,
  designer:  DesignerIcon,
  developer: DeveloperIcon,
  qa:        QAIcon,
  mentor:    MentorIcon,
} as const
