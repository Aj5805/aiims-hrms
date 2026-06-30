import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/endpoints';
import { useAuthStore } from '../stores';
import { isImpersonatingSession } from '../utils/authSession';

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, adminToken, setAuth, dismissPasswordChange } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (isImpersonatingSession(adminToken)) {
      navigate('/', { replace: true });
    }
  }, [adminToken, navigate]);

  const handleSkip = () => {
    dismissPasswordChange();
    navigate('/', { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long');
      return;
    }

    setLoading(true);
    try {
      const { data } = await authApi.changeMyPassword(currentPassword, newPassword);
      setAuth(data.access_token, data.user as any);
      navigate('/');
    } catch (err: any) {
      console.error("Change password error:", err);
      const msg = err.message ||
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to change password';
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  };

  const isForcedPrompt = Boolean(user?.must_change_password) && !isImpersonatingSession(adminToken);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F0F4F8] p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md border-t-4 border-orange-500">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h1 className="text-2xl font-bold text-gray-800">Update Password</h1>
          {isForcedPrompt && (
            <button
              type="button"
              onClick={handleSkip}
              className="text-slate-400 hover:text-slate-600 text-xl leading-none"
              title="Continue without changing"
              aria-label="Close"
            >
              ×
            </button>
          )}
        </div>
        <p className="text-gray-500 mb-6 text-sm">
          {isForcedPrompt
            ? 'You may update your password now, or continue and change it later from your profile.'
            : 'Change your current password.'}
        </p>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <label htmlFor="current_password" className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
          <input
            id="current_password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 mb-4 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
            required
            autoFocus
          />
          
          <label htmlFor="new_password" className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
          <input
            id="new_password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 mb-4 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
            required
            minLength={8}
          />

          <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
          <input
            id="confirm_password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 mb-6 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
            required
            minLength={8}
          />

          <button
            id="change-password-submit"
            type="submit"
            disabled={loading}
            className="w-full bg-orange-600 text-white py-2 rounded-md hover:bg-orange-700 transition disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>

        {isForcedPrompt && (
          <button
            type="button"
            onClick={handleSkip}
            className="w-full mt-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Continue without changing
          </button>
        )}
      </div>
    </div>
  );
}
