import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { authAPI } from '../api/auth';
import toast from 'react-hot-toast';
import { FiMail, FiLock, FiUser, FiPhone, FiX } from 'react-icons/fi';

export default function Login() {
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ username: '', email: '', password: '', confirmPassword: '' });
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotErrors, setForgotErrors] = useState({ email: '', newPassword: '', confirmPassword: '' });
  const { setAuth } = useAuthStore();

  const validate = () => {
    const newErrors = {};
    if (!username.trim()) newErrors.username = 'Username is required';
    else if (username.length < 3) newErrors.username = 'Username must be at least 3 characters';
    else if (!/^[a-zA-Z0-9_]+$/.test(username)) newErrors.username = 'Username must contain only letters, numbers, and underscores';
    if (!email.trim()) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Invalid email format';
    if (!password) newErrors.password = 'Password is required';
    else if (password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    if (!confirmPassword) newErrors.confirmPassword = 'Confirm password is required';
    else if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const response = await authAPI.register(
        email,
        password,
        username
      );
      const { user, tokens } = response.data;
      setAuth(user, tokens.accessToken, tokens.refreshToken);
      toast.success('Registration successful!');
    } catch (error) {
      console.error('Registration error:', error.response?.data);
      let errorMsg = 'Registration failed';
      if (error.response?.data?.error) {
        errorMsg = error.response.data.error;
      } else if (error.response?.data?.errors && error.response.data.errors.length > 0) {
        errorMsg = error.response.data.errors.map(e => e.msg || e.message).join(', ');
      } else if (error.message) {
        errorMsg = error.message;
      }
      // Check for duplicate email or username
      const newErrors = {};
      if (errorMsg.toLowerCase().includes('email') && errorMsg.toLowerCase().includes('already')) {
        newErrors.email = errorMsg;
      }
      if (errorMsg.toLowerCase().includes('username') && errorMsg.toLowerCase().includes('already')) {
        newErrors.username = errorMsg;
      }
      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
      } else {
        toast.error(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    const newErrors = {};
    if (!email.trim()) newErrors.email = 'Email or username is required';
    else if (!/\S+@\S+\.\S+/.test(email) && email.length < 3) newErrors.email = 'Enter a valid email or username';
    if (!password) newErrors.password = 'Password is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.login(email, password);
      const { user, tokens } = response.data;
      setAuth(user, tokens.accessToken, tokens.refreshToken);
      toast.success('Login successful!');
      // Only clear errors on successful login
      setErrors({});
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Invalid email or password';
      const newLoginErrors = {};
      if (errorMsg.toLowerCase().includes('email') || errorMsg.toLowerCase().includes('not found')) {
        newLoginErrors.email = errorMsg;
      } else if (errorMsg.toLowerCase().includes('password')) {
        newLoginErrors.password = errorMsg;
      } else {
        newLoginErrors.email = 'Invalid email or password';
        newLoginErrors.password = 'Invalid email or password';
      }
      setErrors(newLoginErrors);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!forgotEmail.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(forgotEmail)) {
      newErrors.email = 'Invalid email format';
    }

    if (!forgotNewPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (forgotNewPassword.length < 6) {
      newErrors.newPassword = 'Password must be at least 6 characters';
    }

    if (!forgotConfirmPassword) {
      newErrors.confirmPassword = 'Confirm password is required';
    } else if (forgotNewPassword !== forgotConfirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(newErrors).length > 0) {
      setForgotErrors(newErrors);
      return;
    }

    setForgotLoading(true);
    try {
      await authAPI.resetPasswordDirect(forgotEmail, forgotNewPassword);
      toast.success('Password reset successfully! Please login with your new password.');
      setShowForgotPassword(false);
      setForgotEmail('');
      setForgotNewPassword('');
      setForgotConfirmPassword('');
      setForgotErrors({ email: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Failed to reset password. Please try again.';
      if (errorMsg.toLowerCase().includes('email')) {
        setForgotErrors({ ...newErrors, email: errorMsg });
      } else if (errorMsg.toLowerCase().includes('not found')) {
        setForgotErrors({ ...newErrors, email: 'User with this email not found' });
      } else {
        toast.error(errorMsg);
      }
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-8 overflow-y-auto flex-1 scrollbar-thin">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-500 rounded-full mb-4">
              <FiMail className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {mode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {mode === 'login' ? 'Sign in to continue' : 'Sign up to get started'}
            </p>
          </div>

          {/* Mode Toggle */}
          <div className="flex bg-gray-100 dark:bg-dark-700 rounded-lg p-1 mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setEmail('');
                setPassword('');
                setUsername('');
                setConfirmPassword('');
                setErrors({ username: '', email: '', password: '', confirmPassword: '' });
              }}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${mode === 'login'
                ? 'bg-primary-500 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setEmail('');
                setPassword('');
                setUsername('');
                setConfirmPassword('');
                setErrors({ username: '', email: '', password: '', confirmPassword: '' });
              }}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${mode === 'register'
                ? 'bg-primary-500 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
            >
              Register
            </button>
          </div>

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email or Username
                </label>
                <div className="relative">
                  <FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-dark-700 text-gray-900 dark:text-white"
                    placeholder="your@email.com or username"
                    required
                  />
                </div>
                {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-dark-700 text-gray-900 dark:text-white"
                    placeholder="Enter your password"
                    required
                  />
                </div>
                {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
                <div className="mt-2 text-right">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary-500 hover:bg-primary-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-dark-700 text-gray-900 dark:text-white"
                    placeholder="your@email.com"
                    required
                  />
                </div>
                {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Username <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-dark-700 text-gray-900 dark:text-white"
                    placeholder="username"
                    maxLength={30}
                    required
                  />
                </div>
                {errors.username && <p className="mt-1 text-xs text-red-500">{errors.username}</p>}
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Letters, numbers, and underscores only
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-dark-700 text-gray-900 dark:text-white"
                    placeholder="Create a password"
                    required
                  />
                </div>
                {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Min 6 characters
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-dark-700 text-gray-900 dark:text-white"
                    placeholder="Confirm your password"
                    required
                  />
                </div>
                {errors.confirmPassword && <p className="mt-1 text-xs text-red-500">{errors.confirmPassword}</p>}
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary-500 hover:bg-primary-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setEmail('');
                setPassword('');
                setUsername('');
                setConfirmPassword('');
                setErrors({ username: '', email: '', password: '', confirmPassword: '' });
              }}
              className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
            >
              {mode === 'login'
                ? "Don't have an account? Register"
                : 'Already have an account? Login'}
            </button>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-8">
              {/* Close Button */}
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Reset Password</h2>
                <button
                  onClick={() => {
                    setShowForgotPassword(false);
                    setForgotEmail('');
                    setForgotNewPassword('');
                    setForgotConfirmPassword('');
                    setForgotErrors({ email: '', newPassword: '', confirmPassword: '' });
                  }}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <FiX className="w-6 h-6" />
                </button>
              </div>

              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Enter your email and new password to reset your account.
              </p>

              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-dark-700 text-gray-900 dark:text-white"
                      placeholder="your@email.com"
                      required
                    />
                  </div>
                  {forgotErrors.email && <p className="mt-1 text-xs text-red-500">{forgotErrors.email}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="password"
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-dark-700 text-gray-900 dark:text-white"
                      placeholder="Enter new password"
                      required
                    />
                  </div>
                  {forgotErrors.newPassword && <p className="mt-1 text-xs text-red-500">{forgotErrors.newPassword}</p>}
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Min 6 characters
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="password"
                      value={forgotConfirmPassword}
                      onChange={(e) => setForgotConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-dark-700 text-gray-900 dark:text-white"
                      placeholder="Confirm new password"
                      required
                    />
                  </div>
                  {forgotErrors.confirmPassword && <p className="mt-1 text-xs text-red-500">{forgotErrors.confirmPassword}</p>}
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full bg-primary-500 hover:bg-primary-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-6"
                >
                  {forgotLoading ? 'Resetting...' : 'Reset Password'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setForgotEmail('');
                    setForgotNewPassword('');
                    setForgotConfirmPassword('');
                    setForgotErrors({ email: '', newPassword: '', confirmPassword: '' });
                  }}
                  className="w-full bg-gray-200 hover:bg-gray-300 dark:bg-dark-700 dark:hover:bg-dark-600 text-gray-900 dark:text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

