import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Layers } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: (username: string) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showQuickSettings, setShowQuickSettings] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() === 'Admin' && password === 'Admin000') {
      onLoginSuccess(username.trim());
    } else {
      setError('Invalid username or password.');
      setPassword(''); // Clear password on failed attempt
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center px-4 py-10 text-primary">
      <div className="relative w-full max-w-2xl rounded-3xl glass-effect p-8 shadow-glass animate-bloom sm:p-10">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-2 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl glass-icon">
              <Layers size={24} />
            </div>
            <h1 className="text-4xl font-bold text-primary">Liquid Glass Dashboard</h1>
            <p className="text-base text-white/70">
              Sign in to review sales, customers, products, and expenses—all from one streamlined workspace.
            </p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-6 text-left">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-rose-500/40 bg-rose-500/15 px-4 py-3 text-sm text-rose-200"
              >
                {error}
              </motion.div>
            )}

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-white/70" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Admin"
                className="form-input h-14 w-full rounded-2xl border border-transparent bg-white/10 px-4 text-base text-primary placeholder:text-white/50 transition duration-300 ease-in-out hover:border-white/20 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/50"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-white/70" htmlFor="password">
                Access Key
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Admin000"
                className="form-input h-14 w-full rounded-2xl border border-transparent bg-white/10 px-4 text-base text-primary placeholder:text-white/50 transition duration-300 ease-in-out hover:border-white/20 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/50"
                required
              />
            </div>

            <div className="relative">
              <button
                type="submit"
                className="group flex h-14 w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-r from-accent to-indigo-500 text-lg font-semibold text-white shadow-glass transition-transform duration-300 ease-in-out hover:scale-[1.015] active:scale-[0.98]"
              >
                <span>Sign In</span>
              </button>
              <button
                type="button"
                onClick={() => setShowQuickSettings(true)}
                className="absolute -right-4 -top-4 flex size-14 items-center justify-center rounded-full glass-icon text-white transition-transform duration-300 ease-in-out hover:scale-110 active:scale-95"
                aria-label="Open quick settings"
              >
                <span className="material-symbols-outlined text-3xl">add_box</span>
              </button>
            </div>
          </form>

          <p className="text-center text-sm text-white/60">
            Tip: default credentials are <code>Admin</code> / <code>Admin000</code>.
          </p>
        </div>
      </div>

      {showQuickSettings ? (
        <div className="glass-overlay fixed inset-0 z-50 flex items-center justify-center">
          <div className="relative w-full max-w-lg rounded-3xl glass-effect p-8 shadow-glass animate-bloom">
            <button
              className="absolute right-4 top-4 text-white/60 transition hover:text-white"
              onClick={() => setShowQuickSettings(false)}
              aria-label="Close quick settings"
            >
              <span className="material-symbols-outlined text-3xl">close</span>
            </button>
            <h3 className="mb-6 text-2xl font-bold text-primary">Quick Settings</h3>
            <div className="space-y-4">
              {[
                {
                  icon: 'hourglass_empty',
                  title: 'Session Timeout',
                  description: 'Control how long a signed-in session remains active.',
                  controls: (
                    <div className="flex items-center gap-2 text-white">
                      <button className="glass-icon flex h-10 w-10 items-center justify-center text-xl transition-transform hover:scale-105 active:scale-95" type="button">
                        -
                      </button>
                      <input
                        className="w-14 rounded-xl border-none bg-transparent text-center text-lg font-medium text-primary focus:outline-none"
                        type="number"
                        value={60}
                        readOnly
                      />
                      <button className="glass-icon flex h-10 w-10 items-center justify-center text-xl transition-transform hover:scale-105 active:scale-95" type="button">
                        +
                      </button>
                    </div>
                  ),
                },
                {
                  icon: 'preview',
                  title: 'Preview Mode',
                  description: 'Review dashboard changes without saving updates.',
                },
                {
                  icon: 'filter_tilt_shift',
                  title: 'Privacy Mode',
                  description: 'Hide customer and order identifiers during demos.',
                },
                {
                  icon: 'format_paint',
                  title: 'Custom Styling',
                  description: 'Inject optional CSS overrides for brand previews.',
                },
              ].map(({ icon, title, description, controls }) => (
                <div
                  key={title}
                  className="flex items-center justify-between gap-4 rounded-2xl glass-effect p-4 transition-all duration-300 ease-in-out hover:shadow-glass"
                >
                  <div className="flex items-center gap-4">
                    <div className="glass-icon flex size-12 items-center justify-center text-white">
                      <span className="material-symbols-outlined text-2xl">{icon}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-base font-semibold text-primary">{title}</p>
                      <p className="text-sm text-white/65">{description}</p>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {controls ?? (
                      <label className="relative flex h-[35px] w-[58px] cursor-pointer items-center rounded-full glass-icon p-1 transition-all duration-300">
                        <div className="h-full w-[30px] rounded-full bg-white transition-transform duration-300" />
                        <input className="invisible absolute" type="checkbox" />
                      </label>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default LoginPage;
