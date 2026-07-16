/**
 * Settings Page — user profile, change password, logout.
 *
 * Shows the current user's email and account creation date.
 * Provides a logout button. (Password change is a placeholder for now.)
 */

import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { formatDate } from '../utils/format';

export function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
        Settings
      </h1>

      {/* ── Profile section ───────────────────── */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Profile
        </h2>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-500 dark:text-gray-500">
              Email
            </label>
            <p className="text-sm text-gray-900 dark:text-gray-100">
              {user?.email}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500 dark:text-gray-500">
              Member since
            </label>
            <p className="text-sm text-gray-900 dark:text-gray-100">
              {user?.created_at ? formatDate(user.created_at) : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Change password (placeholder) ─────── */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Change Password
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-500">
          Password change functionality will be available in a future update.
        </p>
      </div>

      {/* ── Danger zone ───────────────────────── */}
      <div className="rounded-xl border border-red-200 bg-white p-6 shadow-sm dark:border-red-900 dark:bg-gray-800">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Logout
        </h2>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-500">
          Log out of your account on this device.
        </p>
        <button
          onClick={handleLogout}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
