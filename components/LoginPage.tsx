import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface LoginPageProps {
  onLoginSuccess: (username: string) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

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
    <div className="flex items-center justify-center min-h-screen w-full">
      {/* FIX: Correctly type framer-motion component props */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-sm"
      >
        <form onSubmit={handleLogin} className="glass p-8 space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-primary">Welcome Back</h1>
            <p className="text-muted text-sm mt-1">Sign in to access the dashboard.</p>
          </div>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg p-3 text-center"
            >
              {error}
            </motion.div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="text-sm font-medium text-muted block mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-base text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                placeholder="e.g., Admin"
                required
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="text-sm font-medium text-muted block mb-2"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-base text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                placeholder="••••••••"
                required
              />
            </div>
          </div>
          <button type="submit" className="w-full gloss-btn py-3">
            Sign In
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default LoginPage;
