import { useEffect, useRef, useState } from 'react';
import { GameState, Vector2, UpgradeOption, Monster, Weapon } from './types';
import * as C from './constants';

export const useGameLoop = () => {
  const stateRef = useRef<GameState>(createInitialState());
  const joystickRef = useRef<Vector2>({ x: 0, y: 0 });
  const lastTimeRef = useRef<number>(0);
  const [, forceRender] = useState({});

  useEffect(() => {
    const loop = (time: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = time;
      }
      const dt = Math.min((time - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = time;

      if (stateRef.current.status === 'playing') {
        updateGame(stateRef.current, dt, joystickRef.current);
        forceRender({});
      }

      requestAnimationFrame(loop);
    };
    const req = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(req);
  }, []);

  const setJoystick = (v: Vector2) => {
    joystickRef.current = v;
  };

  const selectUpgrade = (upgrade: UpgradeOption) => {
    upgrade.apply(stateRef.current);
    stateRef.current.status = 'playing';
    checkLevelUp(stateRef.current);
    forceRender({});
  };

  const restart = () => {
    stateRef.current = createInitialState();
    forceRender({});
  };

  const triggerUltimate = () => {
    if (stateRef.current.stats.kills >= 50) {
      stateRef.current.stats.kills = 0;
      // Spawn meteors visually
      for (let i = 0; i < 20; i++) {
        stateRef.current.projectiles.push({
          id: Math.random().toString(),
          x: Math.random() * C.GAME_WIDTH,
          y: stateRef.current.cameraY + Math.random() * C.GAME_HEIGHT,
          radius: 30 + Math.random() * 20,
          vx: 0,
          vy: 0,
          damage: 500,
          type: 'meteor',
          life: 0.5 + Math.random() * 0.5,
        });
      }
      // Deal damage to all monsters
      stateRef.current.monsters.forEach(m => {
        m.hp -= 500;
        addDamageText(stateRef.current, m.x, m.y, 500, '#ffaa00');
      });
      forceRender({});
    }
  };

  return { state: stateRef.current, setJoystick, selectUpgrade, restart, triggerUltimate };
};

function createInitialState(): GameState {
  return {
    status: 'playing',
    cameraY: 0,
    darknessY: C.DARKNESS_START_Y,
    fortress: {
      id: 'fortress',
      x: C.GAME_WIDTH / 2,
      y: C.FORTRESS_Y,
      radius: C.FORTRESS_RADIUS,
      hp: C.FORTRESS_MAX_HP,
      maxHp: C.FORTRESS_MAX_HP,
      speed: C.FORTRESS_SPEED,
      isStuck: false,
    },
    player: {
      id: 'player',
      x: C.GAME_WIDTH / 2,
      y: C.GAME_HEIGHT * 0.7,
      radius: C.PLAYER_RADIUS,
      hp: C.PLAYER_MAX_HP,
      maxHp: C.PLAYER_MAX_HP,
      speed: C.PLAYER_SPEED,
      isGhost: false,
      ghostTimer: 0,
      skillTimer: 0,
      skillCd: C.PLAYER_SKILL_CD,
    },
    monsters: [],
    obstacles: [],
    projectiles: [],
    expGems: [],
    damageTexts: [],
    weapons: [
      {
        id: 'mg1',
        type: 'machine_gun',
        level: 1,
        damage: 10,
        cd: 3,
        timer: 0,
        maxBullets: 30,
        currentBullets: 30,
        fireRate: 0.1,
        fireTimer: 0,
      },
    ],
    stats: {
      exp: 0,
      maxExp: 100,
      level: 1,
      coins: 0,
      kills: 0,
    },
    spawnTimers: {
      monster: 0,
      obstacle: 0,
    },
    level: {
      progress: 0,
      maxDistance: C.LEVEL_MAX_DISTANCE,
      checkpoints: C.CHECKPOINTS,
      currentCheckpoint: 0,
      isAtCheckpoint: false,
      checkpointTimer: 0,
    },
    currentUpgrades: [],
    acquiredUpgrades: [],
  };
}

function updateGame(state: GameState, dt: number, joystick: Vector2) {
  // Cap dt to prevent huge jumps
  if (dt > 0.1) dt = 0.1;

  // 1. Move Player
  if (!state.player.isGhost) {
    state.player.x += joystick.x * state.player.speed * dt;
    state.player.y += joystick.y * state.player.speed * dt;
  } else {
    state.player.x += joystick.x * state.player.speed * 0.5 * dt;
    state.player.y += joystick.y * state.player.speed * 0.5 * dt;
    state.player.ghostTimer -= dt;
    if (state.player.ghostTimer <= 0) {
      state.player.isGhost = false;
      state.player.hp = state.player.maxHp;
    }
  }

  // Clamp player to screen
  state.player.x = Math.max(state.player.radius, Math.min(C.GAME_WIDTH - state.player.radius, state.player.x));
  state.player.y = Math.max(state.player.radius, Math.min(C.GAME_HEIGHT - state.player.radius, state.player.y));

  // 2. Check Fortress Obstacle Collision
  state.fortress.isStuck = false;
  if (!state.level.isAtCheckpoint) {
    for (const obs of state.obstacles) {
      const dx = state.fortress.x - obs.x;
      const dy = state.fortress.y - obs.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < state.fortress.radius + obs.radius && dy < 0) {
        state.fortress.isStuck = true;
        break;
      }
    }
  }

  // 3. Move World (Camera)
  let worldSpeed = 0;
  if (!state.fortress.isStuck && !state.level.isAtCheckpoint) {
    worldSpeed = state.fortress.speed;
    state.cameraY += worldSpeed * dt;
    state.level.progress = state.cameraY / state.level.maxDistance;

    // Check Checkpoint
    if (state.level.currentCheckpoint < state.level.checkpoints.length) {
      const nextCp = state.level.checkpoints[state.level.currentCheckpoint];
      if (state.level.progress >= nextCp) {
        state.level.isAtCheckpoint = true;
        state.level.progress = nextCp;
        state.cameraY = nextCp * state.level.maxDistance;
        state.darknessY = C.DARKNESS_START_Y; // Reset darkness
        spawnCheckpointWave(state);
      }
    }
  }

  // 4. Update Darkness
  if (state.level.isAtCheckpoint) {
    state.darknessY = C.DARKNESS_START_Y;
  } else if (state.fortress.isStuck) {
    state.darknessY += state.fortress.speed * dt;
  } else {
    state.darknessY = Math.max(C.DARKNESS_START_Y, state.darknessY - state.fortress.speed * dt);
  }

  // Darkness Damage
  if (state.darknessY >= state.fortress.y - state.fortress.radius) {
    state.fortress.hp -= C.DARKNESS_DAMAGE_PER_SEC * dt;
    if (state.fortress.hp <= 0) {
      state.status = 'game_over';
    }
  }

  // Darkness damage to player
  if (!state.player.isGhost && state.player.y - C.PLAYER_RADIUS <= state.darknessY) {
    state.player.hp -= (state.player.maxHp * 0.34) * dt;
    if (state.player.hp <= 0) {
      state.player.hp = 0;
      state.player.isGhost = true;
      state.player.ghostTimer = C.GHOST_DURATION;
    }
  }

  // 5. Spawn World Entities
  if (!state.level.isAtCheckpoint && !state.fortress.isStuck) {
    state.spawnTimers.obstacle -= dt;
    if (state.spawnTimers.obstacle <= 0) {
      // 0.007 per frame at 60fps = 0.42 per second -> ~2.38s average
      state.spawnTimers.obstacle = (1 / 0.42) * (0.5 + Math.random());
      spawnObstacle(state);
    }

    state.spawnTimers.monster -= dt;
    if (state.spawnTimers.monster <= 0) {
      // 0.035 per frame at 60fps = 2.1 per second -> ~0.47s average
      // Increased by 50%: 2.1 * 1.5 = 3.15 per second -> ~0.31s average
      state.spawnTimers.monster = (1 / 3.15) * (0.5 + Math.random());
      spawnMonster(state);
    }
  }

  // 6. Update Entities
  updateMonsters(state, dt);
  updateProjectiles(state, dt);
  updateWeapons(state, dt);
  updatePlayerCombat(state, dt);
  updateExpGems(state, dt, worldSpeed);
  updateObstacles(state, dt, worldSpeed);
  updateDamageTexts(state, dt);

  // Check Checkpoint Clear
  if (state.level.isAtCheckpoint) {
    if (state.monsters.length === 0) {
      state.level.isAtCheckpoint = false;
      state.level.currentCheckpoint++;
      if (state.level.currentCheckpoint >= state.level.checkpoints.length) {
        state.status = 'victory';
      }
    }
  }
}

function spawnObstacle(state: GameState) {
  const types: ('rock' | 'tree' | 'chest')[] = ['rock', 'rock', 'tree', 'chest'];
  const type = types[Math.floor(Math.random() * types.length)];
  const hp = type === 'rock' ? C.OBSTACLE_ROCK_HP : type === 'tree' ? C.OBSTACLE_TREE_HP : C.OBSTACLE_CHEST_HP;
  
  let x = 0;
  let y = C.GAME_HEIGHT + 50;
  let validPosition = false;
  let attempts = 0;

  // Try to find a position that isn't too close to other obstacles
  while (!validPosition && attempts < 5) {
    x = Math.random() * (C.GAME_WIDTH - 40) + 20;
    validPosition = true;
    for (const obs of state.obstacles) {
      const dx = obs.x - x;
      const dy = obs.y - y;
      if (Math.sqrt(dx * dx + dy * dy) < C.OBSTACLE_RADIUS * 4) { // Keep them well separated
        validPosition = false;
        break;
      }
    }
    attempts++;
  }

  if (!validPosition) return; // Skip spawning if it's too crowded

  state.obstacles.push({
    id: Math.random().toString(36).substr(2, 9),
    x,
    y,
    radius: C.OBSTACLE_RADIUS,
    hp,
    maxHp: hp,
    type,
  });
}

function spawnMonster(state: GameState) {
  const isFast = Math.random() > 0.5;
  const hp = isFast ? C.MONSTER_FAST_HP : C.MONSTER_SLOW_HP;
  const speed = isFast ? C.MONSTER_FAST_SPEED : C.MONSTER_SLOW_SPEED;
  const target = isFast ? 'fortress' : 'player';
  
  // Spawn from sides
  const x = Math.random() > 0.5 ? -20 : C.GAME_WIDTH + 20;
  const y = Math.random() * C.GAME_HEIGHT;

  state.monsters.push({
    id: Math.random().toString(36).substr(2, 9),
    x,
    y,
    radius: C.MONSTER_RADIUS,
    hp,
    maxHp: hp,
    speed,
    type: isFast ? 'fast' : 'slow',
    target,
    attackTimer: 0,
    damage: C.MONSTER_DAMAGE,
  });
}

function spawnCheckpointWave(state: GameState) {
  const isBoss = state.level.currentCheckpoint === state.level.checkpoints.length - 1;
  const count = 60; // Increased by 200% from 20
  for (let i = 0; i < count; i++) {
    const isFast = Math.random() > 0.5;
    state.monsters.push({
      id: Math.random().toString(36).substr(2, 9),
      x: Math.random() * C.GAME_WIDTH,
      y: C.GAME_HEIGHT + Math.random() * 200,
      radius: C.MONSTER_RADIUS,
      hp: isFast ? C.MONSTER_FAST_HP : C.MONSTER_SLOW_HP,
      maxHp: isFast ? C.MONSTER_FAST_HP : C.MONSTER_SLOW_HP,
      speed: isFast ? C.MONSTER_FAST_SPEED : C.MONSTER_SLOW_SPEED,
      type: isFast ? 'fast' : 'slow',
      target: isFast ? 'fortress' : 'player',
      attackTimer: 0,
      damage: C.MONSTER_DAMAGE,
    });
  }

  // Elite or Boss
  state.monsters.push({
    id: Math.random().toString(36).substr(2, 9),
    x: C.GAME_WIDTH / 2,
    y: C.GAME_HEIGHT + 100,
    radius: C.MONSTER_RADIUS * 2,
    hp: isBoss ? C.MONSTER_BOSS_HP : C.MONSTER_ELITE_HP,
    maxHp: isBoss ? C.MONSTER_BOSS_HP : C.MONSTER_ELITE_HP,
    speed: C.MONSTER_SLOW_SPEED * 0.8,
    type: isBoss ? 'boss' : 'elite',
    target: 'fortress',
    attackTimer: 0,
    damage: C.MONSTER_DAMAGE * 3,
  });
}

function updateMonsters(state: GameState, dt: number) {
  // Count player aggro
  let playerAggro = 0;
  for (const m of state.monsters) {
    if (m.target === 'player') playerAggro++;
  }

  for (let i = state.monsters.length - 1; i >= 0; i--) {
    const m = state.monsters[i];
    
    // AI target switching
    if (m.type === 'slow' && m.target === 'player' && playerAggro > 5) {
      m.target = 'fortress';
      playerAggro--;
    }

    const targetEntity = m.target === 'player' && !state.player.isGhost ? state.player : state.fortress;
    
    const dx = targetEntity.x - m.x;
    const dy = targetEntity.y - m.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    let currentSpeed = m.speed;
    if (m.y < state.fortress.y) {
      currentSpeed += state.fortress.speed * 1.5;
    }

    if (dist > targetEntity.radius + m.radius) {
      m.x += (dx / dist) * currentSpeed * dt;
      m.y += (dy / dist) * currentSpeed * dt;
    } else {
      // Attack
      m.attackTimer -= dt;
      if (m.attackTimer <= 0) {
        m.attackTimer = C.MONSTER_ATTACK_CD;
        targetEntity.hp -= m.damage;
        addDamageText(state, targetEntity.x, targetEntity.y, m.damage, '#ff0000');
        if (targetEntity.id === 'player' && targetEntity.hp <= 0) {
          state.player.isGhost = true;
          state.player.ghostTimer = C.GHOST_DURATION;
        } else if (targetEntity.id === 'fortress' && targetEntity.hp <= 0) {
          state.status = 'game_over';
        }
      }
    }

    // Scroll with world
    if (!state.fortress.isStuck && !state.level.isAtCheckpoint) {
      m.y -= state.fortress.speed * dt;
    }

    if (m.hp <= 0) {
      state.monsters.splice(i, 1);
      state.stats.kills++;
      state.expGems.push({
        id: Math.random().toString(36).substr(2, 9),
        x: m.x,
        y: m.y,
        radius: C.EXP_GEM_RADIUS,
        value: m.type === 'boss' ? 500 : m.type === 'elite' ? 100 : C.EXP_GEM_VALUE,
      });
    } else if (m.y < -50) {
      state.monsters.splice(i, 1); // Despawn
    }
  }
}

function updateProjectiles(state: GameState, dt: number) {
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const p = state.projectiles[i];
    p.life -= dt;
    
    if (p.type === 'meteor') {
      const progress = 1 - (p.life / p.totalLife!);
      p.x = p.startX! + (p.targetX! - p.startX!) * progress;
      p.y = p.startY! + (p.targetY! - p.startY!) * progress;
      
      if (p.life <= 0) {
        // Explode
        state.monsters.forEach(m => {
          const dx = m.x - p.targetX!;
          const dy = m.y - p.targetY!;
          if (Math.sqrt(dx * dx + dy * dy) < 100) {
            m.hp -= p.damage;
            addDamageText(state, m.x, m.y, p.damage, '#ffaa00');
          }
        });
        state.projectiles.splice(i, 1);
      }
      continue;
    }

    if (p.life <= 0) {
      state.projectiles.splice(i, 1);
      continue;
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Scroll with world
    if (!state.fortress.isStuck && !state.level.isAtCheckpoint) {
      p.y -= state.fortress.speed * dt;
      if (p.chain) {
        for (const pt of p.chain) {
          pt.y -= state.fortress.speed * dt;
        }
      }
    }

    if (p.type === 'laser') {
      // Laser already dealt damage in updateWeapons, skip collision
      continue;
    }

    let hit = false;
    for (const m of state.monsters) {
      const dx = m.x - p.x;
      const dy = m.y - p.y;
      if (dx * dx + dy * dy < (m.radius + p.radius) * (m.radius + p.radius)) {
        m.hp -= p.damage;
        addDamageText(state, m.x, m.y, p.damage, '#ffffff');
        hit = true;
        break;
      }
    }

    if (!hit && p.type !== 'laser') {
      for (const o of state.obstacles) {
        const dx = o.x - p.x;
        const dy = o.y - p.y;
        if (dx * dx + dy * dy < (o.radius + p.radius) * (o.radius + p.radius)) {
          o.hp -= p.damage;
          addDamageText(state, o.x, o.y, p.damage, '#aaaaaa');
          hit = true;
          break;
        }
      }
    }

    if (hit && p.type !== 'laser') {
      state.projectiles.splice(i, 1);
    }
  }
}

function updateWeapons(state: GameState, dt: number) {
  for (const w of state.weapons) {
    if (w.type === 'machine_gun') {
      if (w.mgInfiniteTimer! > 0) {
        w.mgInfiniteTimer! -= dt;
        w.fireTimer! -= dt;
        if (w.fireTimer! <= 0) {
          w.fireTimer = 0.1; // Fast fire rate during infinite
          fireMachineGun(state, w);
        }
      } else if (w.currentBullets! > 0) {
        w.fireTimer! -= dt;
        if (w.fireTimer! <= 0) {
          w.fireTimer = w.fireRate;
          w.currentBullets!--;
          fireMachineGun(state, w);

          if (w.currentBullets === 0) {
            w.timer = w.cd;
          }
        }
      } else {
        w.timer -= dt;
        if (w.timer <= 0) {
          w.currentBullets = w.maxBullets;
          if (w.isEvolved) {
            w.mgTriggerCount = (w.mgTriggerCount || 0) + 1;
            if (w.mgTriggerCount % 2 === 0) {
              w.mgInfiniteTimer = 10;
            }
          }
        }
      }
    } else if (w.type === 'laser') {
      w.timer -= dt;
      if (w.timer <= 0) {
        w.timer = w.cd;
        // Find targets
        const targets: Monster[] = [];
        let currentPos = { x: state.fortress.x, y: state.fortress.y };
        
        const maxT = w.isEvolved ? 999 : w.maxTargets!;
        for (let i = 0; i < maxT; i++) {
          let bestTarget = null;
          let minDist = 200; // Same as machine gun
          for (const m of state.monsters) {
            if (targets.includes(m)) continue;
            const dx = m.x - currentPos.x;
            const dy = m.y - currentPos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDist) {
              minDist = dist;
              bestTarget = m;
            }
          }
          if (bestTarget) {
            targets.push(bestTarget);
            currentPos = { x: bestTarget.x, y: bestTarget.y };
            bestTarget.hp -= w.damage;
            addDamageText(state, bestTarget.x, bestTarget.y, w.damage, '#00ffff');
          } else {
            break;
          }
        }

        if (targets.length > 0) {
          // Visual only projectile
          state.projectiles.push({
            id: Math.random().toString(36).substr(2, 9),
            x: state.fortress.x,
            y: state.fortress.y,
            radius: 0,
            vx: 0,
            vy: 0,
            damage: 0,
            type: 'laser',
            life: 0.2, // Show for 0.2s
            chain: [{ x: state.fortress.x, y: state.fortress.y }, ...targets.map(t => ({ x: t.x, y: t.y }))],
          });
        }
      }
    } else if (w.type === 'roadroller') {
      w.timer -= dt;
      if (w.timer <= 0) {
        w.timer = 0.5;
        const rollerY = state.fortress.y + state.fortress.radius + 10;
        const hitRadius = 40;
        
        state.obstacles.forEach(o => {
          const dx = o.x - state.fortress.x;
          const dy = o.y - rollerY;
          if (Math.sqrt(dx * dx + dy * dy) < hitRadius + o.radius) {
            o.hp -= w.damage;
            addDamageText(state, o.x, o.y, w.damage, '#aaaaaa');
          }
        });
        state.monsters.forEach(m => {
          const dx = m.x - state.fortress.x;
          const dy = m.y - rollerY;
          if (Math.sqrt(dx * dx + dy * dy) < hitRadius + m.radius) {
            m.hp -= w.damage;
            addDamageText(state, m.x, m.y, w.damage, '#ff0000');
          }
        });
      }

      if (w.isEvolved) {
        w.roadrollerSmashTimer = (w.roadrollerSmashTimer || 0) - dt;
        if (w.roadrollerSmashTimer <= 0) {
          w.roadrollerSmashTimer = 5;
          const smashY = state.fortress.y + state.fortress.radius + 50;
          state.monsters.forEach(m => {
            const dx = m.x - state.fortress.x;
            const dy = m.y - smashY;
            if (Math.sqrt(dx * dx + dy * dy) < 100) {
              m.hp -= w.damage * 5;
              addDamageText(state, m.x, m.y, w.damage * 5, '#ff5500');
            }
          });
          state.obstacles.forEach(o => {
            const dx = o.x - state.fortress.x;
            const dy = o.y - smashY;
            if (Math.sqrt(dx * dx + dy * dy) < 100) {
              o.hp -= w.damage * 5;
              addDamageText(state, o.x, o.y, w.damage * 5, '#aaaaaa');
            }
          });
        }
      }
    }
  }
}

function fireMachineGun(state: GameState, w: Weapon) {
  let target = null;
  let minDist = 200; // Range
  for (const m of state.monsters) {
    const dx = m.x - state.fortress.x;
    const dy = m.y - state.fortress.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < minDist) {
      minDist = dist;
      target = m;
    }
  }

  if (target) {
    const dx = target.x - state.fortress.x;
    const dy = target.y - state.fortress.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    const numBullets = w.isEvolved ? 5 : 1;
    const spreadAngle = 0.2; // radians
    const baseAngle = Math.atan2(dy, dx);

    for (let i = 0; i < numBullets; i++) {
      const angle = baseAngle + (i - Math.floor(numBullets / 2)) * spreadAngle;
      state.projectiles.push({
        id: Math.random().toString(36).substr(2, 9),
        x: state.fortress.x,
        y: state.fortress.y,
        radius: 3,
        vx: Math.cos(angle) * 300,
        vy: Math.sin(angle) * 300,
        damage: w.damage,
        type: 'bullet',
        life: 2,
      });
    }
  }
}

let playerAttackTimer = 0;
function updatePlayerCombat(state: GameState, dt: number) {
  if (state.player.isGhost) return;

  // Auto Attack
  playerAttackTimer -= dt;
  if (playerAttackTimer <= 0) {
    let attacked = false;
    for (const m of state.monsters) {
      const dx = m.x - state.player.x;
      const dy = m.y - state.player.y;
      if (dx * dx + dy * dy < C.PLAYER_ATTACK_RANGE * C.PLAYER_ATTACK_RANGE) {
        m.hp -= C.PLAYER_ATTACK_DAMAGE;
        addDamageText(state, m.x, m.y, C.PLAYER_ATTACK_DAMAGE, '#ffffff');
        attacked = true;
      }
    }
    for (const o of state.obstacles) {
      const dx = o.x - state.player.x;
      const dy = o.y - state.player.y;
      if (dx * dx + dy * dy < C.PLAYER_ATTACK_RANGE * C.PLAYER_ATTACK_RANGE) {
        o.hp -= C.PLAYER_ATTACK_DAMAGE;
        addDamageText(state, o.x, o.y, C.PLAYER_ATTACK_DAMAGE, '#aaaaaa');
        attacked = true;
      }
    }
    if (attacked) {
      playerAttackTimer = C.PLAYER_ATTACK_CD;
    }
  }

  // Skill
  state.player.skillTimer -= dt;
  if (state.player.skillTimer <= 0) {
    state.player.skillTimer = state.player.skillCd;
    // Fireball
    for (const m of state.monsters) {
      const dx = m.x - state.player.x;
      const dy = m.y - state.player.y;
      if (dx * dx + dy * dy < C.PLAYER_SKILL_RADIUS * C.PLAYER_SKILL_RADIUS) {
        m.hp -= C.PLAYER_SKILL_DAMAGE;
        addDamageText(state, m.x, m.y, C.PLAYER_SKILL_DAMAGE, '#ffaa00');
      }
    }
    // Visual effect
    state.projectiles.push({
      id: Math.random().toString(36).substr(2, 9),
      x: state.player.x,
      y: state.player.y,
      radius: C.PLAYER_SKILL_RADIUS,
      vx: 0,
      vy: 0,
      damage: 0,
      type: 'fireball',
      life: 0.3,
    });
  }
}

function updateExpGems(state: GameState, dt: number, worldSpeed: number) {
  for (let i = state.expGems.length - 1; i >= 0; i--) {
    const gem = state.expGems[i];
    gem.y -= worldSpeed * dt;

    const dx = gem.x - state.player.x;
    const dy = gem.y - state.player.y;
    if (dx * dx + dy * dy < (state.player.radius + 50) * (state.player.radius + 50)) {
      // Magnet
      const dist = Math.sqrt(dx * dx + dy * dy);
      gem.x -= (dx / dist) * 200 * dt;
      gem.y -= (dy / dist) * 200 * dt;

      if (dist < state.player.radius + gem.radius) {
        state.stats.exp += gem.value;
        state.expGems.splice(i, 1);
        checkLevelUp(state);
      }
    } else if (gem.y < -50) {
      state.expGems.splice(i, 1);
    }
  }
}

function updateObstacles(state: GameState, dt: number, worldSpeed: number) {
  for (let i = state.obstacles.length - 1; i >= 0; i--) {
    const o = state.obstacles[i];
    o.y -= worldSpeed * dt;

    if (o.hp <= 0) {
      if (o.type === 'chest') state.stats.coins += 10;
      if (o.type === 'tree') state.stats.coins += 2;
      state.obstacles.splice(i, 1);
    } else if (o.y < -50) {
      state.obstacles.splice(i, 1);
    }
  }
}

function updateDamageTexts(state: GameState, dt: number) {
  for (let i = state.damageTexts.length - 1; i >= 0; i--) {
    const t = state.damageTexts[i];
    t.life -= dt;
    t.y -= 20 * dt; // Float up
    if (t.life <= 0) {
      state.damageTexts.splice(i, 1);
    }
  }
}

function addDamageText(state: GameState, x: number, y: number, damage: number, color: string) {
  state.damageTexts.push({
    id: Math.random().toString(36).substr(2, 9),
    x: x + (Math.random() - 0.5) * 20,
    y: y - 10,
    text: Math.floor(damage).toString(),
    life: 0.5,
    color,
  });
}

function checkLevelUp(state: GameState) {
  if (state.stats.exp >= state.stats.maxExp) {
    state.stats.exp -= state.stats.maxExp;
    state.stats.level++;
    state.stats.maxExp = Math.floor(state.stats.maxExp * 1.5);
    state.status = 'level_up';
    state.currentUpgrades = generateUpgrades(state);
  }
}

function generateUpgrades(state: GameState): UpgradeOption[] {
  const options: UpgradeOption[] = [];
  
  // Generic Upgrades
  options.push({
    id: `hp_up`,
    title: '修复堡垒',
    description: '恢复堡垒200点生命值。',
    apply: (s) => { s.fortress.hp = Math.min(s.fortress.maxHp, s.fortress.hp + 200); }
  });
  options.push({
    id: `player_hp_up`,
    title: '英雄治疗',
    description: '恢复英雄50点生命值。',
    apply: (s) => { s.player.hp = Math.min(s.player.maxHp, s.player.hp + 50); }
  });

  // Check if we can add a new weapon
  if (state.weapons.length < C.WEAPON_MAX_SLOTS) {
    const hasLaser = state.weapons.some(w => w.type === 'laser');
    if (!hasLaser) {
      options.push({
        id: 'new_laser',
        title: '安装激光炮',
        description: '在3个目标间弹射伤害。',
        apply: (s) => {
          s.weapons.push({
            id: Math.random().toString(),
            type: 'laser',
            level: 1,
            damage: 50,
            cd: 4,
            timer: 0,
            maxTargets: 3,
            goldUpgrades: [],
          });
        }
      });
    }
    const hasRoadroller = state.weapons.some(w => w.type === 'roadroller');
    if (!hasRoadroller) {
      options.push({
        id: 'new_roadroller',
        title: '安装压路机',
        description: '在堡垒前方碾碎敌人和障碍物。',
        apply: (s) => {
          s.weapons.push({
            id: Math.random().toString(),
            type: 'roadroller',
            level: 1,
            damage: 20,
            cd: 0.5,
            timer: 0,
            goldUpgrades: [],
          });
        }
      });
    }
  }

  // Helper to add gold upgrade
  const addGoldUpgrade = (w: Weapon, id: string, title: string, description: string, index: number, applyFn: (w: Weapon) => void) => {
    if (!w.goldUpgrades?.includes(id) && !state.acquiredUpgrades.includes(id)) {
      options.push({
        id,
        title: `【金色${index}】${title}`,
        description,
        isGold: true,
        goldIndex: index,
        apply: (s) => {
          const wp = s.weapons.find(x => x.id === w.id);
          if (wp) {
            applyFn(wp);
            wp.goldUpgrades = wp.goldUpgrades || [];
            wp.goldUpgrades.push(id);
            s.acquiredUpgrades.push(id);
            if (wp.goldUpgrades.length >= 3) {
              wp.isEvolved = true;
            }
          }
        }
      });
    }
  };

  // Helper to add normal upgrade
  const addNormalUpgrade = (w: Weapon, id: string, title: string, description: string, applyFn: (w: Weapon) => void) => {
    if (!state.acquiredUpgrades.includes(id)) {
      options.push({
        id,
        title,
        description,
        apply: (s) => {
          const wp = s.weapons.find(x => x.id === w.id);
          if (wp) {
            applyFn(wp);
            s.acquiredUpgrades.push(id);
          }
        }
      });
    }
  };

  // Upgrade existing weapons
  state.weapons.forEach(w => {
    if (w.type === 'machine_gun') {
      addNormalUpgrade(w, `mg_dmg1_${w.id}`, '机枪：伤害提升 I', '机枪伤害增加5点。', wp => wp.damage += 5);
      addNormalUpgrade(w, `mg_dmg2_${w.id}`, '机枪：伤害提升 II', '机枪伤害增加10点。', wp => wp.damage += 10);
      addNormalUpgrade(w, `mg_ammo1_${w.id}`, '机枪：扩充弹匣 I', '机枪弹药增加10发。', wp => { wp.maxBullets! += 10; wp.currentBullets! += 10; });
      
      addGoldUpgrade(w, `mg_gold1_${w.id}`, '机枪：穿甲弹', '伤害大幅提升20点。', 1, wp => wp.damage += 20);
      addGoldUpgrade(w, `mg_gold2_${w.id}`, '机枪：双排弹匣', '弹匣容量翻倍。', 2, wp => { wp.maxBullets! *= 2; wp.currentBullets = wp.maxBullets; });
      addGoldUpgrade(w, `mg_gold3_${w.id}`, '机枪：极速射击', '射速提升50%。', 3, wp => wp.fireRate! *= 0.5);
    } else if (w.type === 'laser') {
      addNormalUpgrade(w, `ls_dmg1_${w.id}`, '激光：伤害提升 I', '激光伤害增加20点。', wp => wp.damage += 20);
      addNormalUpgrade(w, `ls_dmg2_${w.id}`, '激光：伤害提升 II', '激光伤害增加30点。', wp => wp.damage += 30);
      addNormalUpgrade(w, `ls_tgt1_${w.id}`, '激光：弹射+1', '激光额外弹射1个目标。', wp => wp.maxTargets! += 1);
      
      addGoldUpgrade(w, `ls_gold1_${w.id}`, '激光：高能聚焦', '伤害大幅提升50点。', 1, wp => wp.damage += 50);
      addGoldUpgrade(w, `ls_gold2_${w.id}`, '激光：多重折射', '弹射目标+3。', 2, wp => wp.maxTargets! += 3);
      addGoldUpgrade(w, `ls_gold3_${w.id}`, '激光：快速充能', '冷却时间减少1秒。', 3, wp => wp.cd = Math.max(1, wp.cd - 1));
    } else if (w.type === 'roadroller') {
      addNormalUpgrade(w, `rr_dmg1_${w.id}`, '压路机：伤害提升 I', '碾压伤害增加10点。', wp => wp.damage += 10);
      addNormalUpgrade(w, `rr_dmg2_${w.id}`, '压路机：伤害提升 II', '碾压伤害增加20点。', wp => wp.damage += 20);
      addNormalUpgrade(w, `rr_cd1_${w.id}`, '压路机：加速运转', '碾压间隔减少0.1秒。', wp => wp.cd = Math.max(0.1, wp.cd - 0.1));
      
      addGoldUpgrade(w, `rr_gold1_${w.id}`, '压路机：重型滚筒', '伤害大幅提升40点。', 1, wp => wp.damage += 40);
      addGoldUpgrade(w, `rr_gold2_${w.id}`, '压路机：超频引擎', '碾压间隔减半。', 2, wp => wp.cd *= 0.5);
      addGoldUpgrade(w, `rr_gold3_${w.id}`, '压路机：尖刺改装', '伤害再提升40点。', 3, wp => wp.damage += 40);
    }
  });

  // Shuffle and pick 3
  return options.sort(() => Math.random() - 0.5).slice(0, 3);
}
