export function hasActiveTutorCycle(cycle) {
  return cycle?.status === 'active'
}

export function canAccessLibrary(role, activeCycle) {
  if (role === 'admin') return true
  return role === 'tutor' && hasActiveTutorCycle(activeCycle)
}
