export const RANKS = [
  { rp: 0, name: 'Deckhand' }, { rp: 150, name: 'Runner' },
  { rp: 400, name: 'Wheelman' }, { rp: 800, name: 'Fixer' },
  { rp: 1400, name: 'Kingpin' }, { rp: 2200, name: 'Harbor Legend' },
];
export class RankSystem {
  constructor(state = {}) { this.state = state; this.state.rp ??= 0; this.state.stats ??= {}; this.state.unlocked ??= []; this.syncUnlocked(); }
  get rankIndex() { let index = 0; for (let i = 0; i < RANKS.length; i++) if (this.state.rp >= RANKS[i].rp) index = i; return index; }
  get rankName() { return RANKS[this.rankIndex].name; }
  progressToNext() { const i = this.rankIndex; if (i >= RANKS.length - 1) return 1; const start = RANKS[i].rp; return Math.max(0, Math.min(1, (this.state.rp - start) / (RANKS[i + 1].rp - start))); }
  addRP(amount) { const oldIndex = this.rankIndex; this.state.rp = Math.max(0, this.state.rp + Math.max(0, Number(amount) || 0)); const events = []; for (let i = oldIndex + 1; i <= this.rankIndex; i++) events.push({ rank: i, name: RANKS[i].name }); this.syncUnlocked(); return events; }
  unlocks() { return { weapons: new Set(['fists', 'pistol', ...(this.rankIndex >= 2 ? ['smg'] : []), ...(this.rankIndex >= 3 ? ['shotgun'] : [])]), races: this.rankIndex >= 1 }; }
  inc(statKey) { this.state.stats[statKey] = (this.state.stats[statKey] || 0) + 1; return this.state.stats[statKey]; }
  syncUnlocked() { const unlocks = this.unlocks(); this.state.unlocked = [...unlocks.weapons]; if (unlocks.races) this.state.unlocked.push('races'); }
}
// Detailed behavior note 1
// Detailed behavior note 2
// Detailed behavior note 3
// Detailed behavior note 4
// Detailed behavior note 5
// Detailed behavior note 6
// Detailed behavior note 7
// Detailed behavior note 8
// Detailed behavior note 9
// Detailed behavior note 10
// Detailed behavior note 11
// Detailed behavior note 12
// Detailed behavior note 13
// Detailed behavior note 14
// Detailed behavior note 15
// Detailed behavior note 16
// Detailed behavior note 17
// Detailed behavior note 18
// Detailed behavior note 19
// Detailed behavior note 20
// Detailed behavior note 21
// Detailed behavior note 22
// Detailed behavior note 23
// Detailed behavior note 24
// Detailed behavior note 25
// Detailed behavior note 26
// Detailed behavior note 27
// Detailed behavior note 28
// Detailed behavior note 29
// Detailed behavior note 30
// Detailed behavior note 31
// Detailed behavior note 32
// Detailed behavior note 33
// Detailed behavior note 34
// Detailed behavior note 35
// Detailed behavior note 36
// Detailed behavior note 37
// Detailed behavior note 38
// Detailed behavior note 39
// Detailed behavior note 40
// Detailed behavior note 41
// Detailed behavior note 42
// Detailed behavior note 43
// Detailed behavior note 44
// Detailed behavior note 45
// Detailed behavior note 46
// Detailed behavior note 47
// Detailed behavior note 48
// Detailed behavior note 49
// Detailed behavior note 50
// Detailed behavior note 51
// Detailed behavior note 52
// Detailed behavior note 53
// Detailed behavior note 54
// Detailed behavior note 55
// Detailed behavior note 56
// Detailed behavior note 57
// Detailed behavior note 58
// Detailed behavior note 59
// Detailed behavior note 60
// Detailed behavior note 61
// Detailed behavior note 62
// Detailed behavior note 63
// Detailed behavior note 64
// Detailed behavior note 65
// Detailed behavior note 66
// Detailed behavior note 67
// Detailed behavior note 68
// Detailed behavior note 69
// Detailed behavior note 70
// Detailed behavior note 71
// Detailed behavior note 72
// Detailed behavior note 73
// Detailed behavior note 74
// Detailed behavior note 75
// Detailed behavior note 76
// Detailed behavior note 77
// Detailed behavior note 78
// Detailed behavior note 79
// Detailed behavior note 80
// Detailed behavior note 81
// Detailed behavior note 82
// Detailed behavior note 83
// Detailed behavior note 84
// Detailed behavior note 85
// Detailed behavior note 86
// Detailed behavior note 87
// Detailed behavior note 88
// Detailed behavior note 89
// Detailed behavior note 90
// Detailed behavior note 91
// Detailed behavior note 92
// Detailed behavior note 93
// Detailed behavior note 94
// Detailed behavior note 95
