import { useState } from 'react'
import { motion } from 'framer-motion'
import type { Agent } from '../../types'
import styles from './AgentBubble.module.css'

interface AgentBubbleProps {
  agent: Agent
  style?: React.CSSProperties
  floatIndex?: number
  onClick?: () => void
}

const itemVariants = {
  hidden:  { opacity: 0, scale: 0.5 },
  visible: { opacity: 1, scale: 1   }
}

export function AgentBubble({ agent, style, floatIndex = 0, onClick }: AgentBubbleProps) {
  const [imgFailed, setImgFailed] = useState(false)

  const cssVars = {
    '--agent-color':      agent.color,
    '--agent-color-dim':  `${agent.color}33`,
    '--agent-color-glow': `${agent.color}44`,
    '--float-dur':        `${3.4 + floatIndex * 0.35}s`,
    '--float-delay':      `${floatIndex * 0.28}s`,
  } as React.CSSProperties

  return (
    <motion.div
      className={`${styles.wrap} ${onClick ? styles.clickable : ''}`}
      style={{ ...style, ...cssVars }}
      onClick={onClick}
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      exit="hidden"
      transition={{ type: 'spring', stiffness: 280, damping: 22, delay: floatIndex * 0.06 }}
    >
      <div className={styles.bubble}>
        {agent.avatar && !imgFailed
          ? <img className={styles.avatar} src={agent.avatar} alt={agent.name} onError={() => setImgFailed(true)} />
          : <span className={styles.emoji}>{agent.emoji}</span>
        }
      </div>
      <span className={styles.name}>{agent.name}</span>
    </motion.div>
  )
}
