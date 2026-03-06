import type { Agent } from '@shared/types'

const DICEBEAR = 'https://api.dicebear.com/9.x/notionists/svg'

export const AGENTS: Agent[] = [
  {
    id: 'sia', name: '시아', role: 'Developer', emoji: '👩‍💻', color: '#6366F1',
    avatar: `${DICEBEAR}?seed=Sia&backgroundColor=6366F1&gesture=point&gestureProbability=100`
  },
  {
    id: 'aerok', name: '애록', role: 'Writer', emoji: '✍️', color: '#EC4899',
    avatar: `${DICEBEAR}?seed=Aerok&backgroundColor=EC4899&gesture=ok&gestureProbability=100`
  },
  {
    id: 'junja', name: '준자', role: 'Gamer', emoji: '🎮', color: '#F59E0B',
    avatar: `${DICEBEAR}?seed=Junja&backgroundColor=F59E0B&gesture=waveLongArm&gestureProbability=100`
  }
]
