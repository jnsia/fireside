import type { Agent } from '../types'

const DICEBEAR = 'https://api.dicebear.com/9.x/notionists/svg'

export const AGENTS: Agent[] = [
  {
    id: 'planner', name: '기획자', role: 'Product Manager', emoji: '📋', color: '#F4A261',
    avatar: `${DICEBEAR}?seed=planner-c&backgroundColor=F4A261&glassesProbability=100&gesture=point&gestureProbability=100`
  },
  {
    id: 'designer', name: '디자이너', role: 'UI/UX Designer', emoji: '🎨', color: '#E76F51',
    avatar: `${DICEBEAR}?seed=designer-b&backgroundColor=E76F51&gesture=ok&gestureProbability=100`
  },
  {
    id: 'developer', name: '개발자', role: 'Software Engineer', emoji: '💻', color: '#2A9D8F',
    avatar: `${DICEBEAR}?seed=engineer&backgroundColor=2A9D8F&beardProbability=40&glassesProbability=50`
  },
  {
    id: 'qa', name: 'QA', role: 'Quality Assurance', emoji: '🔍', color: '#5C8B9B',
    avatar: `${DICEBEAR}?seed=quality&backgroundColor=5C8B9B&glassesProbability=100&gesture=waveLongArm&gestureProbability=100`
  },
  {
    id: 'mentor', name: '멘토', role: 'Senior Advisor', emoji: '🦉', color: '#E9C46A',
    avatar: `${DICEBEAR}?seed=advisor&backgroundColor=E9C46A&beardProbability=80&glassesProbability=60`
  }
]
