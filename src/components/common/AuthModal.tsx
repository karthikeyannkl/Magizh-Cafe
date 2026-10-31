import React, { useState, useEffect } from 'react';
import {
  X,
  Lock,
  User as UserIcon,
  Mail,
  Phone,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  KeyRound,
  Eye,
  EyeOff,
  ShoppingBag,
} from 'lucide-react';
import { StorageService } from '../../services/storage';
import { User } from '../../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
  onRegistrationSuccess?: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onRegistrationSuccess,
}) => {
  const [view, setView] = useState<'login' | 'register' | 'forgot'>('login');

  // Customer Registration & Login Fields
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Forgot Password State
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStep, setForgotStep] = useState<'request' | 'verify' | 'new-password'>('request');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [demoResetOtp, setDemoResetOtp] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Cooldown timer effect
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  if (!isOpen) return null;

  const resetMessages = () => {
    setError('');
    setSuccessMsg('');
  };

  // 1. Password-Based Login
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);

    if (!mobile && !email) {
      setError('Please enter your mobile number or email address.');
      setLoading(false);
      return;
    }
    if (!password) {
      setError('Please enter your account password.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: mobile ? mobile.trim() : undefined,
          email: email ? email.trim() : undefined,
          password,
        }),
      });

      const data = await res.json();
      if (res.ok && data.user) {
        StorageService.setCurrentUser(data.user);
        onSuccess(data.user);
        onClose();
        setLoading(false);
        return;
      } else {
        setError(data.error || 'Invalid credentials. User not found.');
        setLoading(false);
        return;
      }
    } catch {
      // Local fallback
      const user = mobile
        ? StorageService.findUserByMobile(mobile.trim())
        : StorageService.findUserByEmail(email.trim());

      if (user) {
        StorageService.setCurrentUser(user);
        onSuccess(user);
        onClose();
      } else {
        setError('Invalid credentials. User not found.');
      }
      setLoading(false);
    }
  };

  // 2. Password-Based Customer Registration (Strictly creates a Customer account)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    if (!name || name.trim().length < 2) {
      setError('Please enter your full name.');
      return;
    }

    const cleanMobile = mobile.trim().replace(/\D/g, '');
    if (!/^\d{10}$/.test(cleanMobile)) {
      setError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Password and Confirm Password do not match.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          mobile: cleanMobile,
          email: email.trim().toLowerCase(),
          password,
          confirmPassword,
        }),
      });

      const data = await res.json();
      setLoading(false);

      if (res.ok && data.user) {
        StorageService.saveUser(data.user);
        StorageService.setCurrentUser(data.user);

        // Notify registration celebration trigger
        if (onRegistrationSuccess) {
          onRegistrationSuccess(data.user);
        } else {
          onSuccess(data.user);
        }
        onClose();
      } else {
        setError(data.error || 'Registration failed.');
      }
    } catch (err) {
      setLoading(false);
      setError('Registration failed due to network error.');
    }
  };

  // 3. Password Recovery Flow
  const handleRequestPasswordResetOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      const data = await res.json();
      setLoading(false);

      if (res.ok) {
        setForgotStep('verify');
        setCooldownSeconds(data.cooldownSeconds || 60);
        setDemoResetOtp(data.demoOtp || null);
        setSuccessMsg(data.message || 'Verification code sent to your registered email.');
      } else {
        setError(data.error || 'Failed to dispatch reset code.');
      }
    } catch {
      setLoading(false);
      setError('Could not connect to password recovery service.');
    }
  };

  const handleVerifyResetOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify-reset-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim(), otp: resetOtp.trim() }),
      });
      const data = await res.json();
      setLoading(false);

      if (res.ok && data.valid) {
        setForgotStep('new-password');
        setSuccessMsg('Verification code confirmed. Enter your new password below.');
      } else {
        setError(data.error || 'Invalid or expired verification code.');
      }
    } catch {
      setLoading(false);
      setError('Verification service unreachable.');
    }
  };

  const handleCommitNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== resetConfirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotEmail.trim(),
          otp: resetOtp.trim(),
          newPassword,
        }),
      });
      const data = await res.json();
      setLoading(false);

      if (res.ok) {
        setSuccessMsg('Your password has been securely updated! You may now sign in.');
        setTimeout(() => {
          setView('login');
          setForgotStep('request');
          resetMessages();
        }, 1800);
      } else {
        setError(data.error || 'Failed to update password.');
      }
    } catch {
      setLoading(false);
      setError('Failed to update password.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-darkbrown-950/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-cream-300 w-full max-w-md overflow-hidden animate-in zoom-in-95">
        {/* Royal Modal Header */}
        <div className="bg-gradient-to-r from-magizh-900 to-magizh-800 text-white p-5 sm:p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-cream-200 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="bg-amber-500 text-darkbrown-950 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
              Magizh Customer Portal
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black tracking-tight">
            {view === 'login' && 'Customer Sign In'}
            {view === 'register' && 'Create Customer Account'}
            {view === 'forgot' && 'Password Recovery'}
          </h3>
          <p className="text-xs text-cream-200 mt-1">
            {view === 'login' && 'Sign in to access your 50% B5 Coin savings & order history'}
            {view === 'register' && 'Join Magizh Shopping and receive 100 Welcome B5 Coins'}
            {view === 'forgot' && 'Reset your password securely via email verification'}
          </p>
        </div>

        {/* Modal Form Container */}
        <div className="p-5 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-semibold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* VIEW 1: SIGN IN */}
          {view === 'login' && (
            <form onSubmit={handlePasswordLogin} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-darkbrown-900 mb-1">
                  Registered Mobile Number or Email Address
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                  <input
                    type="text"
                    value={mobile || email}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.includes('@')) {
                        setEmail(val);
                        setMobile('');
                      } else {
                        setMobile(val.replace(/\D/g, ''));
                        setEmail('');
                      }
                    }}
                    placeholder="9876543210 or user@magizh.in"
                    className="w-full pl-9 pr-3 py-2.5 bg-cream-50 border border-cream-300 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-magizh-700 text-darkbrown-900"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-darkbrown-900">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setView('forgot');
                      resetMessages();
                    }}
                    className="text-[11px] text-b5-700 hover:text-b5-800 hover:underline font-bold"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full pl-9 pr-10 py-2.5 bg-cream-50 border border-cream-300 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-magizh-700 text-darkbrown-900"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-magizh-800 to-magizh-900 hover:from-magizh-900 hover:to-darkbrown-900 text-white rounded-xl text-xs sm:text-sm font-black shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <KeyRound className="w-4 h-4 text-amber-300" />
                <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
              </button>
            </form>
          )}

          {/* VIEW 2: CUSTOMER REGISTRATION */}
          {view === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-darkbrown-900 mb-1">
                  Full Name *
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Saravanan K"
                    className="w-full pl-9 pr-3 py-2 bg-cream-50 border border-cream-300 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-magizh-700 text-darkbrown-900"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-darkbrown-900 mb-1">
                  Mobile Number (10 Digits) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-bold text-gray-500 font-mono">+91</span>
                  <input
                    type="tel"
                    maxLength={10}
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                    placeholder="9876543210"
                    className="w-full pl-11 pr-3 py-2 bg-cream-50 border border-cream-300 rounded-xl text-xs sm:text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-magizh-700 text-darkbrown-900"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-darkbrown-900 mb-1">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="saravanan@magizh.in"
                    className="w-full pl-9 pr-3 py-2 bg-cream-50 border border-cream-300 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-magizh-700 text-darkbrown-900"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-darkbrown-900 mb-1">
                  Password (min 6 characters) *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create secure password"
                    className="w-full pl-9 pr-10 py-2 bg-cream-50 border border-cream-300 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-magizh-700 text-darkbrown-900"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-darkbrown-900 mb-1">
                  Confirm Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    className="w-full pl-9 pr-10 py-2 bg-cream-50 border border-cream-300 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-magizh-700 text-darkbrown-900"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-b5-600 to-amber-600 hover:from-b5-700 hover:to-amber-700 text-white rounded-xl text-xs sm:text-sm font-black shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 text-yellow-200" />
                <span>{loading ? 'Creating Account...' : 'Register & Claim 100 B5 Coins'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* VIEW 3: FORGOT PASSWORD */}
          {view === 'forgot' && (
            <div className="space-y-3.5">
              {forgotStep === 'request' && (
                <form onSubmit={handleRequestPasswordResetOtp} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-darkbrown-900 mb-1">
                      Enter Registered Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="saravanan@magizh.in"
                        className="w-full pl-9 pr-3 py-2 bg-cream-50 border border-cream-300 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-magizh-700 text-darkbrown-900"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || cooldownSeconds > 0}
                    className="w-full py-2.5 bg-magizh-800 hover:bg-magizh-900 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <span>{loading ? 'Sending Code...' : cooldownSeconds > 0 ? `Resend in ${cooldownSeconds}s` : 'Send Verification Code'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}

              {forgotStep === 'verify' && (
                <form onSubmit={handleVerifyResetOtp} className="space-y-3">
                  {demoResetOtp && (
                    <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 font-bold flex items-center justify-between">
                      <span>Demo Verification Code:</span>
                      <span className="font-mono bg-white px-2 py-0.5 rounded border border-amber-300">
                        {demoResetOtp}
                      </span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-darkbrown-900 mb-1">
                      Enter 6-Digit Verification Code
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={resetOtp}
                      onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      className="w-full text-center tracking-widest text-lg font-mono font-bold py-2 bg-cream-50 border border-cream-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-magizh-700 text-darkbrown-900"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 bg-magizh-800 hover:bg-magizh-900 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <span>{loading ? 'Verifying...' : 'Verify Code'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}

              {forgotStep === 'new-password' && (
                <form onSubmit={handleCommitNewPassword} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-darkbrown-900 mb-1">
                      New Password (min 6 characters)
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full p-2.5 bg-cream-50 border border-cream-300 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-magizh-700 text-darkbrown-900"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-darkbrown-900 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={resetConfirmPassword}
                      onChange={(e) => setResetConfirmPassword(e.target.value)}
                      className="w-full p-2.5 bg-cream-50 border border-cream-300 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-magizh-700 text-darkbrown-900"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <KeyRound className="w-4 h-4 text-emerald-200" />
                    <span>{loading ? 'Saving...' : 'Save New Password'}</span>
                  </button>
                </form>
              )}

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setView('login');
                    setForgotStep('request');
                    resetMessages();
                  }}
                  className="text-xs text-magizh-800 font-bold hover:underline"
                >
                  &larr; Back to Customer Sign In
                </button>
              </div>
            </div>
          )}

          {/* Toggle Register / Login */}
          <div className="pt-3 border-t border-cream-200 text-center text-xs text-gray-600">
            {view === 'login' ? (
              <span>
                New to Magizh Shopping?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setView('register');
                    resetMessages();
                  }}
                  className="text-magizh-800 font-bold hover:underline"
                >
                  Create an account
                </button>
              </span>
            ) : view === 'register' ? (
              <span>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setView('login');
                    resetMessages();
                  }}
                  className="text-magizh-800 font-bold hover:underline"
                >
                  Sign In
                </button>
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
