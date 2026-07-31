import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Check, ArrowRight } from 'lucide-react';

export interface ConstellationNode {
  id: number;
  label: string;
  x: number;
  y: number;
}

export const CONSTELLATION_NODES: ConstellationNode[] = [
  { id: 0, label: 'Welcome', x: 120, y: 170 },
  { id: 1, label: 'Profile', x: 210, y: 90 },
  { id: 2, label: 'Interests', x: 320, y: 70 },
  { id: 3, label: 'Privacy', x: 420, y: 120 },
  { id: 4, label: 'Import', x: 470, y: 220 },
  { id: 5, label: 'Path', x: 360, y: 280 },
  { id: 6, label: 'Ready', x: 220, y: 260 },
];

export const CONSTELLATION_CONNECTIONS: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 6],
  [6, 0],
  [1, 5],
  [2, 4],
];

interface ConstellationViewProps {
  activeStepIndex: number;
  completedStepIndices: number[];
  isZoomingIn: boolean;
  isZoomingOut: boolean;
  selectedTheme?: 'light' | 'dark';
  onEnterStep: () => void;
  onSelectNode: (index: number) => void;
}

export default function ConstellationView({
  activeStepIndex,
  completedStepIndices,
  isZoomingIn,
  isZoomingOut,
  selectedTheme,
  onEnterStep,
  onSelectNode,
}: ConstellationViewProps) {
  const activeNode = CONSTELLATION_NODES[activeStepIndex] || CONSTELLATION_NODES[0];

  const [isDark, setIsDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, [selectedTheme]);

  const isLight = !isDark;

  // Auto zoom-in timer if in constellation mode
  useEffect(() => {
    if (!isZoomingIn && !isZoomingOut) {
      const timer = setTimeout(() => {
        onEnterStep();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [activeStepIndex, isZoomingIn, isZoomingOut, onEnterStep]);

  // Transform origin based on active star coordinate (out of 600 x 360 SVG space)
  const originX = `${(activeNode.x / 600) * 100}%`;
  const originY = `${(activeNode.y / 360) * 100}%`;

  return (
    <div className={`fixed inset-0 z-50 flex flex-col items-center justify-between p-6 sm:p-10 select-none overflow-hidden font-sans transition-colors duration-300 ${
      isLight ? 'bg-zinc-50 text-zinc-900' : 'bg-zinc-950 text-white'
    }`}>
      {/* Background ambient stars */}
      <div className={`absolute inset-0 pointer-events-none ${isLight ? 'opacity-30' : 'opacity-40'}`}>
        <div className={`absolute top-1/4 left-1/6 w-1 h-1 rounded-full animate-ping ${isLight ? 'bg-zinc-700' : 'bg-white'}`} />
        <div className="absolute top-1/3 right-1/4 w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
        <div className="absolute bottom-1/4 left-1/3 w-1 h-1 bg-teal-500 rounded-full animate-pulse" />
        <div className={`absolute bottom-1/3 right-1/6 w-1 h-1 rounded-full animate-ping ${isLight ? 'bg-zinc-700' : 'bg-white'}`} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Top Header Badge */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="pt-2 flex flex-col items-center gap-1.5 z-20 text-center"
      >
        <div className={`inline-flex items-center gap-2 px-3.5 py-1 rounded-full border text-xs font-semibold tracking-wide shadow-sm ${
          isLight 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
        }`}>
          <Sparkles size={13} className={isLight ? 'text-emerald-600' : 'text-emerald-400'} />
          <span>Step {activeStepIndex + 1} of 7: {activeNode.label}</span>
        </div>
      </motion.div>

      {/* Constellation Canvas wrapper with Motion Zoom Scale */}
      <div className="relative w-full max-w-2xl h-[340px] sm:h-[400px] my-auto flex items-center justify-center z-10">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={
            isZoomingIn
              ? { scale: 7, opacity: 0 }
              : isZoomingOut
              ? { scale: 0.8, opacity: 0 }
              : { scale: 1, opacity: 1 }
          }
          transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformOrigin: `${originX} ${originY}` }}
          className="w-full h-full flex items-center justify-center"
        >
          <svg
            viewBox="0 0 600 360"
            className="w-full h-full max-h-[400px] drop-shadow-[0_0_30px_rgba(16,185,129,0.25)]"
          >
            <defs>
              <linearGradient id="activeLine" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#34d399" stopOpacity="0.6" />
              </linearGradient>
              <linearGradient id="dimLine" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={isLight ? '#a1a1aa' : '#3f3f46'} stopOpacity={isLight ? '0.6' : '0.4'} />
                <stop offset="100%" stopColor={isLight ? '#e4e4e7' : '#27272a'} stopOpacity={isLight ? '0.4' : '0.2'} />
              </linearGradient>
              <filter id="starGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Connecting Lines */}
            {CONSTELLATION_CONNECTIONS.map(([startIdx, endIdx], i) => {
              const start = CONSTELLATION_NODES[startIdx];
              const end = CONSTELLATION_NODES[endIdx];
              const isConnected =
                completedStepIndices.includes(startIdx) &&
                (completedStepIndices.includes(endIdx) || activeStepIndex === endIdx);

              return (
                <motion.line
                  key={`line-${i}`}
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  stroke={isConnected ? 'url(#activeLine)' : 'url(#dimLine)'}
                  strokeWidth={isConnected ? 2 : 1}
                  strokeDasharray={isConnected ? '0' : '4 3'}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: i * 0.05 }}
                />
              );
            })}

            {/* Star Nodes */}
            {CONSTELLATION_NODES.map((node) => {
              const isActive = node.id === activeStepIndex;
              const isCompleted = completedStepIndices.includes(node.id);

              return (
                <g
                  key={`node-${node.id}`}
                  onClick={() => onSelectNode(node.id)}
                  className="cursor-pointer group"
                >
                  {/* Pulsing Active Outer Ring */}
                  {isActive && (
                    <motion.circle
                      cx={node.x}
                      cy={node.y}
                      r="16"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="1.5"
                      initial={{ scale: 0.8, opacity: 0.3 }}
                      animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0.2, 0.6] }}
                      transition={{
                        duration: 1.6,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                    />
                  )}

                  {/* Star Core */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={isActive ? 7 : isCompleted ? 5 : 4}
                    fill={isActive ? '#34d399' : isCompleted ? '#10b981' : isLight ? '#a1a1aa' : '#52525b'}
                    filter={isActive ? 'url(#starGlow)' : undefined}
                    className="transition-all duration-300"
                  />

                  {/* Inner checkmark if completed */}
                  {isCompleted && !isActive && (
                    <circle cx={node.x} cy={node.y} r="2" fill="#ffffff" />
                  )}

                  {/* Label */}
                  <text
                    x={node.x}
                    y={node.y + 24}
                    textAnchor="middle"
                    fill={isActive ? (isLight ? '#09090b' : '#ffffff') : isCompleted ? '#10b981' : isLight ? '#52525b' : '#a1a1aa'}
                    fontSize={isActive ? '11' : '10'}
                    fontWeight={isActive ? '700' : '500'}
                    letterSpacing="0.03em"
                    className="transition-colors duration-200"
                  >
                    {node.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </motion.div>
      </div>

      {/* Bottom Floating Action Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="w-full max-w-sm flex flex-col items-center gap-3 text-center z-20 pb-4"
      >
        <button
          type="button"
          onClick={onEnterStep}
          className="w-full py-3.5 px-6 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.99] text-white font-bold text-xs rounded-2xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>Open {activeNode.label}</span>
          <ArrowRight size={14} />
        </button>
      </motion.div>
    </div>
  );
}
