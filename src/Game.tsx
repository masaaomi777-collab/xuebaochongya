import React, { useEffect, useRef, useState } from 'react';
import { useGameLoop } from './useGameLoop';
import { Joystick } from './Joystick';
import * as C from './constants';
import { GameState, UpgradeOption } from './types';
import { Skull, Flag, Crosshair, Zap, ShieldAlert, Coins, Swords } from 'lucide-react';

export default function Game() {
  const { state, setJoystick, selectUpgrade, restart, triggerUltimate } = useGameLoop();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [safeToClick, setSafeToClick] = useState(false);

  useEffect(() => {
    if (state.status === 'level_up') {
      const timer = setTimeout(() => setSafeToClick(true), 800);
      return () => clearTimeout(timer);
    } else {
      setSafeToClick(false);
    }
  }, [state.status]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Render loop
    const render = () => {
      ctx.clearRect(0, 0, C.GAME_WIDTH, C.GAME_HEIGHT);

      // Draw Background (Road)
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(0, 0, C.GAME_WIDTH, C.GAME_HEIGHT);
      
      // Draw Road lines
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 4;
      ctx.setLineDash([20, 20]);
      ctx.beginPath();
      ctx.moveTo(C.GAME_WIDTH / 2, - (state.cameraY % 40));
      ctx.lineTo(C.GAME_WIDTH / 2, C.GAME_HEIGHT);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Darkness
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(0, 0, C.GAME_WIDTH, state.darknessY);
      
      // Draw Darkness Edge
      ctx.fillStyle = '#ff0000';
      ctx.globalAlpha = 0.3 + Math.sin(Date.now() / 200) * 0.2;
      ctx.fillRect(0, state.darknessY - 10, C.GAME_WIDTH, 10);
      ctx.globalAlpha = 1.0;

      // Draw Obstacles
      state.obstacles.forEach(o => {
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `${o.radius * 2}px Arial`;
        if (o.type === 'rock') {
          ctx.fillText('🪨', 0, 0);
        } else if (o.type === 'tree') {
          ctx.fillText('🌲', 0, 0);
        } else if (o.type === 'chest') {
          ctx.fillText('🎁', 0, 0);
        }
        // HP Bar
        drawHpBar(ctx, 0, -o.radius - 10, o.radius * 2, 4, o.hp, o.maxHp);
        ctx.restore();
      });

      // Draw Exp Gems
      state.expGems.forEach(g => {
        ctx.save();
        ctx.translate(g.x, g.y);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `${g.radius * 2.5}px Arial`;
        ctx.fillText('💎', 0, 0);
        ctx.restore();
      });

      // Draw Monsters
      state.monsters.forEach(m => {
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `${m.radius * 2}px Arial`;
        if (m.type === 'fast') {
          ctx.fillText('🦇', 0, 0);
        } else if (m.type === 'slow') {
          ctx.fillText('🧟', 0, 0);
        } else if (m.type === 'elite') {
          ctx.fillText('🧛', 0, 0);
        } else if (m.type === 'boss') {
          ctx.fillText('🐉', 0, 0);
        }
        drawHpBar(ctx, 0, -m.radius - 10, m.radius * 2, 4, m.hp, m.maxHp);
        ctx.restore();
      });

      // Draw Projectiles
      state.projectiles.forEach(p => {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (p.type === 'bullet') {
          ctx.font = `${p.radius * 3}px Arial`;
          ctx.fillText('☄️', 0, 0);
        } else if (p.type === 'laser') {
          if (p.targetId) {
             ctx.font = `30px Arial`;
             ctx.fillText('⚡', 0, 0);
          }
        } else if (p.type === 'fireball') {
          ctx.font = `${p.radius * 2}px Arial`;
          ctx.fillText('🔥', 0, 0);
        } else if (p.type === 'meteor') {
          ctx.font = `${p.radius * 2}px Arial`;
          ctx.fillText('🌠', 0, 0);
        }
        ctx.restore();
      });

      // Draw Fortress
      ctx.save();
      ctx.translate(state.fortress.x, state.fortress.y);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `${state.fortress.radius * 2}px Arial`;
      ctx.fillText('🏰', 0, 0);
      
      // Draw Weapons on Fortress
      state.weapons.forEach((w, i) => {
        if (w.type === 'roadroller') {
          ctx.font = `30px Arial`;
          ctx.fillText('🛞', 0, state.fortress.radius + 10);
          return;
        }
        const angle = (i / C.WEAPON_MAX_SLOTS) * Math.PI * 2;
        const wx = Math.cos(angle) * (state.fortress.radius + 5);
        const wy = Math.sin(angle) * (state.fortress.radius + 5);
        ctx.font = `16px Arial`;
        ctx.fillText(w.type === 'machine_gun' ? '🔫' : '📡', wx, wy);
      });

      drawHpBar(ctx, 0, -state.fortress.radius - 15, state.fortress.radius * 2, 6, state.fortress.hp, state.fortress.maxHp);
      
      if (state.fortress.isStuck) {
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('清理道路！', 0, -state.fortress.radius - 25);
      }
      ctx.restore();

      // Draw Player
      ctx.save();
      ctx.translate(state.player.x, state.player.y);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `${state.player.radius * 2}px Arial`;
      
      if (state.player.isGhost) {
        ctx.globalAlpha = 0.5;
        ctx.fillText('👻', 0, 0);
      } else {
        ctx.fillText('🦸', 0, 0);
        // Sword
        ctx.font = `20px Arial`;
        ctx.fillText('⚔️', state.player.radius + 5, 0);
      }

      ctx.globalAlpha = 1.0;
      drawHpBar(ctx, 0, -state.player.radius - 10, state.player.radius * 2, 4, state.player.hp, state.player.maxHp);
      ctx.restore();

      // Draw Damage Texts
      state.damageTexts.forEach(t => {
        ctx.fillStyle = t.color;
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.globalAlpha = t.life / 0.5;
        ctx.fillText(t.text, t.x, t.y);
        ctx.globalAlpha = 1.0;
      });

      requestAnimationFrame(render);
    };

    const req = requestAnimationFrame(render);
    return () => cancelAnimationFrame(req);
  }, [state]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-black text-white font-sans overflow-hidden touch-none">
      {/* Game Container 9:16 */}
      <div 
        className="relative bg-gray-900 shadow-2xl overflow-hidden"
        style={{ width: C.GAME_WIDTH, height: C.GAME_HEIGHT }}
      >
        <canvas
          ref={canvasRef}
          width={C.GAME_WIDTH}
          height={C.GAME_HEIGHT}
          className="absolute inset-0"
        />

        {/* UI Overlay */}
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4">
          {/* Top UI */}
          <div className="flex justify-between items-start">
            {/* Left: Exp & Level */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-4 h-32 bg-gray-800 rounded-full overflow-hidden border border-gray-700 relative">
                <div 
                  className="absolute bottom-0 w-full bg-cyan-400 transition-all duration-200"
                  style={{ height: `${(state.stats.exp / state.stats.maxExp) * 100}%` }}
                />
              </div>
              <div className="text-xs font-bold bg-gray-800 px-2 py-1 rounded-md border border-gray-700 shadow-md">
                Lv {state.stats.level}
              </div>
            </div>

            {/* Right: Route Progress */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-4 h-48 bg-gray-800 rounded-full relative border border-gray-700">
                {/* Progress Fill */}
                <div 
                  className="absolute top-0 w-full bg-emerald-500 rounded-full transition-all duration-200"
                  style={{ height: `${state.level.progress * 100}%` }}
                />
                
                {/* Checkpoints */}
                {state.level.checkpoints.map((cp, i) => {
                  const isBoss = i === state.level.checkpoints.length - 1;
                  return (
                    <div 
                      key={i}
                      className="absolute w-6 h-6 -left-1 flex items-center justify-center rounded-full bg-gray-900 border-2 border-gray-600 z-10"
                      style={{ top: `calc(${cp * 100}% - 12px)` }}
                    >
                      {isBoss ? <Skull size={12} className="text-red-500" /> : <ShieldAlert size={12} className="text-purple-500" />}
                    </div>
                  );
                })}
                
                {/* Current Position Indicator */}
                <div 
                  className="absolute w-8 h-8 -left-2 flex items-center justify-center z-20 transition-all duration-200"
                  style={{ top: `calc(${state.level.progress * 100}% - 16px)` }}
                >
                  <div className="w-4 h-4 bg-white rounded-full shadow-[0_0_10px_white]" />
                </div>
              </div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                End
              </div>
            </div>
          </div>

          {/* Bottom UI */}
          <div className="flex justify-between items-end pointer-events-auto">
            {/* Left: Weapon Slots */}
            <div className="grid grid-cols-2 gap-2 mb-4 ml-2">
              {Array.from({ length: C.WEAPON_MAX_SLOTS }).map((_, i) => {
                const w = state.weapons[i];
                const progress = w ? Math.max(0, w.timer / w.cd) : 0;
                const isEvolved = w?.isEvolved;
                const isMgInfinite = w?.type === 'machine_gun' && (w.mgInfiniteTimer || 0) > 0;
                return (
                  <div key={i} className={`relative w-10 h-10 rounded-full bg-gray-800/80 border flex items-center justify-center shadow-lg backdrop-blur-sm overflow-hidden ${isEvolved ? 'border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]' : 'border-gray-600'}`}>
                    {w && (
                      <>
                        <span className="text-xl z-10">
                          {w.type === 'machine_gun' ? '🔫' : w.type === 'laser' ? '📡' : '🛞'}
                        </span>
                        {isMgInfinite && (
                          <span className="absolute inset-0 flex items-center justify-center text-2xl z-0 opacity-50 animate-pulse">🔥</span>
                        )}
                        {w.timer > 0 && !isMgInfinite && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60" style={{ height: `${progress * 100}%` }} />
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Center: Joystick */}
            <div className="flex-1 flex justify-center mb-8">
              <Joystick onChange={setJoystick} size={120} />
            </div>

            {/* Right: Skills */}
            <div className="flex flex-col gap-4 mb-8 mr-4 pointer-events-auto">
              {/* Auto Skill Circular Progress */}
              <div className="relative w-14 h-14 rounded-full bg-gray-800/80 border border-gray-600 flex items-center justify-center shadow-lg backdrop-blur-sm">
                 <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <path className="text-gray-700" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    <path className="text-orange-500" strokeWidth="3" strokeDasharray={`${Math.max(0, 1 - state.player.skillTimer / state.player.skillCd) * 100}, 100`} stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                 </svg>
                 <span className="text-2xl z-10">🔥</span>
                 {state.player.skillTimer > 0 && (
                    <span className="absolute text-xs font-bold text-white z-20 drop-shadow-md">
                      {Math.ceil(state.player.skillTimer)}
                    </span>
                 )}
              </div>

              {/* Ultimate Skill Water Level */}
              <button 
                onClick={triggerUltimate}
                disabled={state.stats.kills < 50}
                className={`relative w-14 h-14 rounded-full border-2 flex items-center justify-center overflow-hidden transition-all ${state.stats.kills >= 50 ? 'border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.6)] cursor-pointer' : 'border-gray-600 opacity-80 cursor-not-allowed'}`}
              >
                 <div className="absolute bottom-0 left-0 right-0 bg-blue-500/50 transition-all duration-300" style={{ height: `${Math.min(100, (state.stats.kills / 50) * 100)}%` }} />
                 <span className="text-2xl z-10">{state.stats.kills >= 50 ? '🌠' : '💧'}</span>
                 {state.stats.kills < 50 && <span className="absolute text-[10px] font-bold z-10 text-white drop-shadow-md">{state.stats.kills}/50</span>}
              </button>
            </div>
          </div>
        </div>

        {/* Level Up Screen */}
        {state.status === 'level_up' && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-6 z-50 pointer-events-auto">
            <h2 className="text-3xl font-bold text-white mb-8 tracking-wider uppercase text-center">
              升级！选择一项升级
            </h2>
            <div className="flex flex-col gap-4 w-full max-w-xs">
              {state.currentUpgrades.map((u, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (safeToClick) selectUpgrade(u);
                  }}
                  className={`bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-xl p-4 text-left transition-all shadow-lg ${safeToClick ? 'active:scale-95' : 'opacity-80 cursor-not-allowed'}`}
                >
                  <h3 className={`text-lg font-bold mb-1 ${u.isGold ? 'text-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.8)]' : 'text-cyan-400'}`}>{u.title}</h3>
                  <p className="text-sm text-gray-300">{u.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Game Over / Victory Screen */}
        {(state.status === 'game_over' || state.status === 'victory') && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 z-50 pointer-events-auto">
            <h2 className={`text-4xl font-bold mb-4 uppercase tracking-widest ${state.status === 'victory' ? 'text-yellow-400' : 'text-red-500'}`}>
              {state.status === 'victory' ? '胜利！' : '游戏结束'}
            </h2>
            <div className="flex items-center gap-2 text-xl text-gray-300 mb-8">
              <Coins size={24} className="text-yellow-500" />
              <span>收集了 {state.stats.coins} 个金币</span>
            </div>
            <button
              onClick={restart}
              className="bg-white text-black font-bold py-3 px-8 rounded-full text-lg hover:bg-gray-200 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)]"
            >
              重新开始
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function drawHpBar(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, hp: number, maxHp: number) {
  ctx.fillStyle = '#000';
  ctx.fillRect(x - width / 2, y - height / 2, width, height);
  ctx.fillStyle = '#f00';
  const hpWidth = Math.max(0, (hp / maxHp) * width);
  ctx.fillRect(x - width / 2, y - height / 2, hpWidth, height);
}


