export const GAME_WIDTH = 360;
export const GAME_HEIGHT = 640;
export const FPS = 60;
export const DT = 1 / FPS;

export const FORTRESS_Y = GAME_HEIGHT * 0.33;
export const FORTRESS_RADIUS = 30;
export const FORTRESS_SPEED = 30; // pixels per second
export const FORTRESS_MAX_HP = 1000;

export const PLAYER_RADIUS = 15;
export const PLAYER_SPEED = 120;
export const PLAYER_MAX_HP = 100;
export const PLAYER_ATTACK_RANGE = 40;
export const PLAYER_ATTACK_DAMAGE = 50;
export const PLAYER_ATTACK_CD = 0.5;
export const PLAYER_SKILL_CD = 10;
export const PLAYER_SKILL_DAMAGE = 100;
export const PLAYER_SKILL_RADIUS = 80;
export const GHOST_DURATION = 10;

export const DARKNESS_START_Y = GAME_HEIGHT * 0.1;
export const DARKNESS_DAMAGE_PER_SEC = FORTRESS_MAX_HP / 3;

export const MONSTER_FAST_SPEED = 60;
export const MONSTER_SLOW_SPEED = 30;
export const MONSTER_FAST_HP = 30;
export const MONSTER_SLOW_HP = 50;
export const MONSTER_ELITE_HP = 500;
export const MONSTER_BOSS_HP = 2000;
export const MONSTER_DAMAGE = 10;
export const MONSTER_ATTACK_CD = 1;
export const MONSTER_RADIUS = 12;

export const OBSTACLE_ROCK_HP = 100;
export const OBSTACLE_TREE_HP = 50;
export const OBSTACLE_CHEST_HP = 20;
export const OBSTACLE_RADIUS = 20;

export const EXP_GEM_RADIUS = 5;
export const EXP_GEM_VALUE = 10;

export const LEVEL_MAX_DISTANCE = 5000;
export const CHECKPOINTS = [0.33, 0.66, 1.0];

export const WEAPON_MAX_SLOTS = 6;
