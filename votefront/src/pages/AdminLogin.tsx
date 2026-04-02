import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true); // <-- Added state
  const navigate = useNavigate();

  // --- THE SILENT CHECK ---
  useEffect(() => {
    document.title = "Login | Promnight 2026 Vote Area";

    const checkExistingLogin = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/admin/verify`, {
          method: 'GET',
          credentials: 'include' // Send the HttpOnly cookie if it exists
        });

        if (response.ok) {
          // Cookie is valid! Teleport to dashboard
          navigate('/admin/dashboard', { replace: true });
        } else {
          // No valid cookie, show the login form
          setIsCheckingAuth(false);
        }
      } catch (err) {
        // Network error, show the login form just in case
        setIsCheckingAuth(false);
      }
    };

    checkExistingLogin();
  }, [navigate]);
  // ------------------------

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', 
        body: JSON.stringify({ password })
      });

      const data = await response.json();

      if (response.ok) {
        navigate('/admin/dashboard');
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Network error. Cannot reach server.');
    } finally {
      setIsLoading(false);
    }
  };

  // Prevent the login form from flashing while we check the cookie
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white max-w-sm w-full rounded-3xl shadow-2xl p-8 border border-gray-100 animate-[fadeIn_0.3s_ease-out]">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">
          🔒
        </div>
        <h1 className="text-2xl font-black text-gray-800 text-center mb-2">Admin Portal</h1>
        <p className="text-gray-500 text-center text-sm font-medium mb-8">Enter master password to access live results.</p>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input 
              type="password" 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-lg px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-center tracking-widest"
              required
            />
          </div>
          
          {error && <p className="text-red-500 text-sm font-bold text-center">{error}</p>}
          
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-black shadow-lg shadow-blue-200 active:scale-95 transition-all disabled:opacity-70"
          >
            {isLoading ? 'Verifying...' : 'Access Dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
}