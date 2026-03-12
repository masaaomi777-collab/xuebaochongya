export interface Vector2 {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  x: number;
  y: number;
  radius: number;
}

export interface Fortress extends Entity {
  hp: number;
  maxHp: number;
  speed: number;
  isStuck: boolean;
}

export interface Player extends Entity {
  hp: number;
  maxHp: number;
  speed: number;
  isGhost: boolean;
  ghostTimer: number;
  skillTimer: number;
  skillCd: number;
}

export interface Monster extends Entity {
  hp: number;
  maxHp: number;
  speed: number;
  type: 'fast' | 'slow' | 'elite' | 'boss';
  target: 'player' | 'fortress';
  attackTimer: number;
  damage: number;
}

export interface Obstacle extends Entity {
  hp: number;
  maxHp: number;
  type: 'rock' | 'tree' | 'chest';
}

export interface Projectile extends Entity {
  vx: number;
  vy: number;
  damage: number;
  type: 'bullet' | 'fireball' | 'laser' | 'meteor';
  targetId?: string;
  life: number;
  totalLife?: number;
  startX?: number;
  startY?: number;
  targetX?: number;
  targetY?: number;
  chain?: {x: number, y: number}[];
}

export interface ExpGem extends Entity {
  value: number;
}

export interface DamageText {
  id: string;
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
}

export interface Weapon {
  id: string;
  type: 'machine_gun' | 'laser' | 'roadroller';
  level: number;
  damage: number;
  cd: number;
  timer: number;
  isEvolved?: boolean;
  goldUpgrades?: string[];
  // Machine gun specific
  maxBullets?: number;
  currentBullets?: number;
  fireRate?: number;
  fireTimer?: number;
  mgTriggerCount?: number;
  mgInfiniteTimer?: number;
  // Laser specific
  maxTargets?: number;
  // Roadroller specific
  roadrollerSmashTimer?: number;
}

export interface GameState {
  status: 'playing' | 'paused' | 'level_up' | 'game_over' | 'victory';
  cameraY: number;
  darknessY: number;
  fortress: Fortress;
  player: Player;
  monsters: Monster[];
  obstacles: Obstacle[];
  projectiles: Projectile[];
  expGems: ExpGem[];
  damageTexts: DamageText[];
  weapons: Weapon[];
  stats: {
    exp: number;
    maxExp: number;
    level: number;
    coins: number;
    kills: number;
  };
  spawnTimers: {
    monster: number;
    obstacle: number;
  };
  level: {
    progress: number; // 0 to 1
    maxDistance: number;
    checkpoints: number[]; // e.g., [0.33, 0.66, 1.0]
    currentCheckpoint: number;
    isAtCheckpoint: boolean;
    checkpointTimer: number;
  };
  currentUpgrades: UpgradeOption[];
  acquiredUpgrades: string[];
}

export interface UpgradeOption {
  id: string;
  title: string;
  description: string;
  apply: (state: GameState) => void;
  isGold?: boolean;
  goldIndex?: number;
}
