import React, { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { Metric } from '../types';

export const NavItem: React.FC<{
  icon: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
}> = ({ icon, label, active, onClick, badge }) => (
  <button
    onClick={onClick}
    className={`group flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-all duration-200 ${
      active
        ? 'glass-effect text-primary shadow-glass'
        : 'text-white/60 hover:text-primary hover:bg-white/10'
    }`}
  >
    <div
      className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all ${
        active
          ? 'glass-icon text-accent shadow-glass'
          : 'glass-icon text-white/70 group-hover:text-primary'
      }`}
    >
      {icon}
    </div>
    <div className="flex-1 text-left">{label}</div>
    {badge && badge > 0 ? (
      <div className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent shadow-glass">
        {badge}
      </div>
    ) : null}
  </button>
);

export const MobileNavItem: React.FC<{
  icon: ReactNode;
  active: boolean;
  onClick: () => void;
}> = ({ icon, active, onClick }) => (
  <button
    onClick={onClick}
    className={`relative flex flex-1 items-center justify-center p-3 text-white/60 transition-all ${
      active ? 'text-accent' : 'hover:text-primary'
    }`}
  >
    {icon}
    {active && (
      // FIX: Correctly type framer-motion component props
      <motion.div
        layoutId="mobile-nav-active"
        className="absolute bottom-[-8px] h-[3px] w-8 rounded-full bg-accent"
      />
    )}
  </button>
);

type GlassCardProps = {
  title?: string;
  subtitle?: string;
  className?: string;
  children: ReactNode;
};

export const GlassCard: React.FC<GlassCardProps> = ({
  title,
  subtitle,
  className,
  children,
}) => {
  return (
    <section
      className={`glass-effect rounded-3xl p-6 shadow-glass ${className || ''}`}
    >
      {(title || subtitle) && (
        <header className="mb-5">
          {title ? (
            <h2 className="text-lg font-semibold text-primary">{title}</h2>
          ) : null}
          {subtitle ? (
            <p className="mt-1 text-sm text-muted">{subtitle}</p>
          ) : null}
        </header>
      )}
      {children}
    </section>
  );
};

export const ActionCard: React.FC<{
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
}> = ({ icon, title, description, onClick, variant = 'default' }) => {
  const isDanger = variant === 'danger';
  const wrapperClasses = `group h-full rounded-3xl glass-effect text-left shadow-glass transition-transform duration-200 hover:-translate-y-1`;
  const iconClasses = `inline-flex w-fit rounded-2xl p-3 transition-colors ${
    isDanger
      ? 'glass-icon text-rose-300'
      : 'glass-icon text-emerald-300'
  }`;
  const ctaClasses = `mt-auto text-sm font-semibold ${
    isDanger ? 'text-rose-300' : 'text-emerald-300'
  }`;

  return (
    <button onClick={onClick} className={wrapperClasses}>
      <div className="flex h-full flex-col gap-4 rounded-[1.25rem] p-6">
        <div className={iconClasses}>
          {icon}
        </div>
        <h3 className="text-lg font-semibold text-primary">{title}</h3>
        <p className="mt-1 flex-grow text-sm text-muted">{description}</p>
        <div className={ctaClasses}>Open</div>
      </div>
    </button>
  );
};

export const MetricCard: React.FC<{ metric: Metric; onClick?: () => void }> = ({
  metric,
  onClick,
}) => {
  const colorClasses = {
    green: 'from-emerald-400/25 via-transparent to-transparent text-emerald-300',
    blue: 'from-accent/25 via-transparent to-transparent text-accent',
    purple: 'from-violet-400/25 via-transparent to-transparent text-violet-300',
    orange: 'from-amber-400/25 via-transparent to-transparent text-amber-300',
  } as const;
  const colorClass =
    colorClasses[metric.color as keyof typeof colorClasses] ||
    colorClasses.green;

  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      onClick={onClick}
      className={`glass-effect rounded-3xl shadow-glass ${
        onClick
          ? 'cursor-pointer transition-transform duration-200 hover:-translate-y-1'
          : ''
      }`}
    >
      <div className="flex h-full items-start gap-6 rounded-3xl p-6">
        <div
          className={`flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${colorClass}`}
        >
          {metric.icon}
        </div>
        <div className="flex-grow">
          <p className="text-sm font-medium text-muted">{metric.title}</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-primary">
            {metric.value}
          </p>
          <p className="mt-2 text-xs text-muted">{metric.subtitle}</p>
        </div>
      </div>
    </Wrapper>
  );
};
