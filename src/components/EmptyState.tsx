import React from 'react';
import { LucideIcon, Inbox } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionLink?: string;
  onAction?: () => void;
  className?: string;
}

export default function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  actionLink,
  onAction,
  className
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center p-8 bg-zinc-50/60 dark:bg-zinc-900/40 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl space-y-3 max-w-md mx-auto my-4", className)}>
      <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
        <Icon size={24} />
      </div>
      <div className="space-y-1">
        <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{title}</h4>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs leading-relaxed">{description}</p>
      </div>
      {actionLabel && (
        <div className="pt-2">
          {actionLink ? (
            <Link
              to={actionLink}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-emerald-500/10 inline-flex items-center justify-center gap-2"
            >
              {actionLabel}
            </Link>
          ) : onAction ? (
            <button
              type="button"
              onClick={onAction}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-emerald-500/10 inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              {actionLabel}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
