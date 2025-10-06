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
    className={`flex items-center gap-3 w-full text-base p-3 rounded-lg transition-all ${
      active
        ? 'bg-white/10 text-primary font-semibold'
        : 'hover:bg-white/5 text-muted font-medium'
    }`}
  >
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${active ? 'bg-indigo-500 text-white' : 'bg-white/5 text-primary'}`}>
      {icon}
    </div>
    <div className="flex-1 text-left">{label}</div>
    {badge && badge > 0 ? (
      <div className="bg-purple-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full">
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
    className={`relative flex-1 flex items-center justify-center p-3 text-muted transition-colors ${
      active ? 'text-indigo-400' : 'hover:text-primary'
    }`}
  >
    {icon}
    {active && (
      // FIX: Correctly type framer-motion component props
      <motion.div
        layoutId="mobile-nav-active"
        className="absolute bottom-[-8px] h-[3px] w-8 bg-indigo-400 rounded-full"
      />
    )}
  </button>
);

export const GlassCard: React.FC<{ title?: string; children: ReactNode }> = ({ title, children }) => (
    <div className="glass-wrap">
        <div className="glass p-6">
            {title && <h2 className="text-xl font-bold text-primary mb-6">{title}</h2>}
            {children}
        </div>
    </div>
);

export const ActionCard: React.FC<{
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
}> = ({ icon, title, description, onClick, variant = 'default' }) => {
  const colors = {
    default: {
        icon: 'group-hover:text-indigo-400',
        text: 'text-indigo-400',
        iconBg: 'group-hover:bg-indigo-500/10'
    },
    danger: {
        icon: 'group-hover:text-purple-400',
        text: 'text-purple-400',
        iconBg: 'group-hover:bg-purple-500/10'
    }
  };
  const color = colors[variant];

  return (
    <button
      onClick={onClick}
      className="glass-wrap group h-full"
    >
      <div className="glass p-6 text-left h-full flex flex-col transition-all duration-300 border border-transparent group-hover:border-[var(--glass-border-hover)] group-hover:bg-[var(--glass-bg-hover)]">
          <div className={`bg-white/5 p-3 rounded-lg w-fit text-primary mb-4 transition-colors ${color.iconBg} ${color.icon}`}>
              {icon}
          </div>
          <h3 className="font-bold text-lg text-primary">{title}</h3>
          <p className="text-sm text-muted mt-1 flex-grow">{description}</p>
          <div className={`text-sm font-bold ${color.text} mt-4 self-start transition-transform group-hover:translate-x-1`}>
              Proceed &rarr;
          </div>
      </div>
    </button>
  );
};


export const MetricCard: React.FC<{ metric: Metric, onClick?: () => void }> = ({ metric, onClick }) => {
    const colorClasses = {
        green: 'from-green-500/10 to-green-500/0 text-green-400',
        blue: 'from-blue-500/10 to-blue-500/0 text-blue-400',
        purple: 'from-purple-500/10 to-purple-500/0 text-purple-400',
        orange: 'from-orange-500/10 to-orange-500/0 text-orange-400',
    };
    const colorClass = colorClasses[metric.color as keyof typeof colorClasses] || colorClasses.green;

    const Wrapper = onClick ? 'button' : 'div';
    
    return (
        <Wrapper
            onClick={onClick}
            className={`glass-wrap group ${onClick ? 'cursor-pointer' : ''}`}
        >
            <div className={`glass p-6 text-left h-full flex items-start gap-6 transition-all duration-300 border border-transparent ${onClick ? 'group-hover:border-[var(--glass-border-hover)] group-hover:bg-[var(--glass-bg-hover)]' : ''}`}>
                <div className={`w-20 h-20 rounded-2xl flex-shrink-0 flex items-center justify-center bg-gradient-to-br ${colorClass}`}>
                    {metric.icon}
                </div>
                <div className="flex-grow">
                    <p className="text-sm font-medium text-muted">{metric.title}</p>
                    <p className="text-4xl font-bold tracking-tight text-primary mt-1">{metric.value}</p>
                    <p className="text-xs text-muted mt-2">{metric.subtitle}</p>
                </div>
            </div>
        </Wrapper>
    );
};