import { ROLES, type Rol } from '../types'

const colorMap: Record<string, string> = {
  yellow: 'bg-tn-yellow/10 text-tn-yellow',
  purple: 'bg-purple-400/10 text-purple-400',
  blue:   'bg-blue-400/10 text-blue-400',
  green:  'bg-green-400/10 text-green-400',
}

export default function RolBadge({ rol }: { rol: Rol }) {
  const def = ROLES.find(r => r.value === rol)
  if (!def) return null
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${colorMap[def.color]}`}>
      {def.label}
    </span>
  )
}
