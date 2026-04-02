import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import WelcomeScreen from './WelcomeScreen';
import VotingCarousel from './VotingCarousel';
import type { Category, VoteSelection } from '../types';

type VoteStatus = 'loading' | 'error' | 'welcome' | 'confirm' | 'voting' | 'success' | 'already_voted';

const getTokenFromHash = (hash: string) => {
  if (!hash.startsWith('#') || hash.length <= 1) {
    return '';
  }

  try {
    return decodeURIComponent(hash.slice(1));
  } catch {
    return hash.slice(1);
  }
};

export default function VotePage() {
  
  const navigate = useNavigate();
  const [token] = useState(() => getTokenFromHash(window.location.hash));
  
  const [status, setStatus] = useState<VoteStatus>('loading'); 
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [studentId, setStudentId] = useState<string>('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    switch (status) {
      case 'success':
        document.title = "Vote Recorded | Promnight 2026 Vote Area";
        break;
      case 'already_voted':
        document.title = "Token Expired | Promnight 2026 Vote Area";
        break;
      case 'error':
        document.title = "Invalid Token | Promnight 2026 Vote Area";
        break;
      default:
        // Covers 'loading', 'welcome', 'confirm', and 'voting'
        document.title = "Promnight 2026 Vote Area";
        break;
    }
  }, [status]);

  useEffect(() => {
    const verifyToken = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/verify-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
        const data = await response.json();

        if (response.status === 403) {
          setStatus('already_voted');
          return;
        }

        if (!response.ok) {
          setErrorMessage(data.error || 'Invalid token');
          setStatus('error');
          return;
        }

        setStudentId(data.student_id);
        setStatus('welcome'); 

      } catch (err) {
        setErrorMessage('Network error connecting to the server.');
        setStatus('error');
      }
    };

    if (token) {
      verifyToken();
    } else {
      setErrorMessage('Missing or invalid voting link.');
      setStatus('error');
    }
  }, [token]);

  useEffect(() => {
    if (status === 'voting') {
      fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/categories`)
        .then(res => res.json())
        .then(data => setCategories(data))
        .catch(() => {
          setErrorMessage("Failed to load ballot. Please refresh.");
          setStatus('error');
        });
    }
  }, [status]);

  const handleVoteSubmit = async (finalVotes: VoteSelection[]) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, votes: finalVotes })
      });

      if (response.ok) {
        setStatus('success'); 
      } else {
        const data = await response.json();
        if (response.status === 400 && data.error === 'You have already voted.') {
            setStatus('already_voted');
        } else {
            setErrorMessage(data.error || "Submission failed.");
            setStatus('error');
        }
      }
    } catch (err) {
      setErrorMessage("Network error. Please check your connection.");
      setStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  //               RENDER STATES
  // ==========================================

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#e4dcc2] flex flex-col items-center justify-center">
        {/* THEME FIX: Burgundy Spinner */}
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-red-900 mb-4"></div>
        <p className="text-red-900 font-bold tracking-wide animate-pulse">Verifying secure link...</p>
      </div>
    );
  }

  if (status === 'welcome') {
    return <WelcomeScreen onComplete={() => setStatus('confirm')} studentId={studentId} />;
  }

  if (status === 'confirm') {
    return (
      <div className="min-h-screen bg-[#e4dcc2] flex items-center justify-center p-4">
        <div className="bg-white max-w-md w-full rounded-3xl shadow-xl p-8 text-center border border-stone-200">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">👋</span>
          </div>
          <h1 className="text-2xl font-black text-stone-800 mb-2">Identity Check</h1>
          <p className="text-stone-500 mb-6 font-medium">Are you really voting as:</p>
          {/* THEME FIX: Burgundy & Gold Identity Card */}
          <div className="text-3xl font-black text-red-900 mb-8 tracking-wider bg-red-50 py-4 rounded-2xl border border-red-100">
            {studentId}
          </div>
          
          <div className="space-y-3">
            <button 
              onClick={() => setStatus('voting')} 
              className="w-full bg-red-900 text-amber-500 py-4 rounded-xl font-black text-lg shadow-lg shadow-red-900/20 active:scale-95 transition-transform"
            >
              Yes, Start Voting
            </button>
            <button 
              onClick={() => navigate('/')} 
              className="w-full bg-stone-100 text-stone-500 py-4 rounded-xl font-bold text-lg active:bg-stone-200 transition-colors"
            >
              No, That's Not Me
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'voting') {
    if (categories.length === 0) {
      return (
        <div className="min-h-screen bg-[#e4dcc2] flex flex-col items-center justify-center">
          {/* THEME FIX: Burgundy Spinner */}
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-red-900 mb-4"></div>
          <p className="text-red-900 font-bold">Loading your ballot...</p>
        </div>
      );
    }
    
    return (
      <div className="min-h-screen bg-[#e4dcc2]">
        {isSubmitting ? (
          <div className="fixed inset-0 bg-[#e4dcc2]/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
            {/* THEME FIX: Burgundy Spinner for Submission */}
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-red-900 mb-4"></div>
            <h2 className="text-3xl font-['Cormorant_Infant'] font-bold text-red-900">Casting your vote...</h2>
            <p className="text-stone-500 mt-2 font-medium">Please do not close this page.</p>
          </div>
        ) : (
          <VotingCarousel categories={categories} onSubmit={handleVoteSubmit} />
        )}
      </div>
    );
  }

// --- THEME FIX: PREMIUM SUCCESS SCREEN (ENVELOPE) ---
  if (status === 'success') {
    return (
      <div className="min-h-screen bg-red-900 flex items-center justify-center p-4">
        <div className="relative bg-[#FCFBF8] max-w-md w-full rounded-3xl shadow-2xl text-center pt-[150px] pb-10 px-8 mt-12 animate-[scale-in_0.3s_ease-out]">
          
          {/* --- ENVELOPE FLAP EFFECT --- */}
          <div className="absolute inset-0 pointer-events-none rounded-3xl overflow-hidden">
            <svg 
              viewBox="0 0 100 100" 
              preserveAspectRatio="none" 
              className="absolute top-0 left-0 w-full h-[120px] drop-shadow-[0_4px_4px_rgba(0,0,0,0.05)]"
            >
              {/* Slightly darker beige fill for the flap to contrast the #FCFBF8 card */}
              <polygon points="-10,-10 110,-10 50,100" fill="#f0ede1" stroke="#e4dcc2" strokeWidth="0.5" />
            </svg>
          </div>

          {/* --- GOLD WAX SEAL --- */}
          <div className="absolute top-[120px] left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-24 h-24 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-5xl font-black shadow-inner border-[4px] border-[#FCFBF8] ring-1 ring-amber-200">
            ✓
          </div>
          {/* --------------------------- */}

          <div className="relative z-10"><br />
            <h1 className="text-4xl font-['Cormorant_Infant'] font-bold text-red-900 mb-4 py-2">Vote Cast!</h1>
            <p className="text-stone-600 mb-8 text-lg font-medium leading-relaxed">
              Thank you for participating. Your choices have been securely locked in and sealed.
            </p>
            <button 
              onClick={() => window.location.replace('/')} 
              className="w-full bg-red-900 text-amber-500 py-4 rounded-xl font-bold text-lg shadow-lg active:scale-95 transition-transform"
            >
              Return to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- THEME FIX: ALREADY VOTED SCREEN (ENVELOPE) ---
  if (status === 'already_voted') {
    return (
      <div className="min-h-screen bg-red-900 flex items-center justify-center p-4">
        <div className="relative bg-white max-w-md w-full rounded-3xl shadow-xl text-center border border-stone-200 pt-[150px] pb-10 px-8 mt-12">
          
          {/* --- ENVELOPE FLAP EFFECT --- */}
          <div className="absolute inset-0 pointer-events-none rounded-3xl overflow-hidden">
            <svg 
              viewBox="0 0 100 100" 
              preserveAspectRatio="none" 
              className="absolute top-0 left-0 w-full h-[120px] drop-shadow-[0_4px_4px_rgba(0,0,0,0.05)]"
            >
              <polygon points="-10,-10 110,-10 50,100" fill="#f7f7f6" stroke="#e7e5e4" strokeWidth="0.5" />
            </svg>
          </div>

          {/* --- GREY WAX SEAL --- */}
          <div className="absolute top-[120px] left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-20 h-20 bg-stone-100 text-stone-500 rounded-full flex items-center justify-center text-4xl shadow-md border-[4px] border-white ring-1 ring-stone-200">
            🗳️
          </div>
          {/* --------------------------- */}

          <div className="relative z-10"><br />
            <h1 className="text-3xl font-['Cormorant_Infant'] font-bold text-stone-800 mb-2">Already Voted</h1>
            <p className="text-stone-500 mb-8 font-medium">
              This link has already been used to cast a ballot.
            </p>
            <p className="text-stone-400 mb-8 font-medium italic">
              Each student may only vote once.
            </p>
            <button 
              onClick={() => navigate('/')}
              className="w-full bg-orange-200 text-stone-700 py-4 rounded-xl font-bold text-lg hover:bg-orange-300 active:bg-orange-400 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- THEME FIX: ERROR SCREEN (ENVELOPE) ---
  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#e4dcc2] flex items-center justify-center p-4">
        <div className="relative bg-white max-w-md w-full rounded-3xl shadow-xl text-center border border-red-100 pt-[150px] pb-10 px-8 mt-12">
          
          {/* --- ENVELOPE FLAP EFFECT --- */}
          <div className="absolute inset-0 pointer-events-none rounded-3xl overflow-hidden">
            <svg 
              viewBox="0 0 100 100" 
              preserveAspectRatio="none" 
              className="absolute top-0 left-0 w-full h-[120px] drop-shadow-[0_4px_4px_rgba(0,0,0,0.05)]"
            >
              <polygon points="-10,-10 110,-10 50,100" fill="#f7f7f6" stroke="#e7e5e4" strokeWidth="0.5" />
            </svg>
          </div>

          {/* --- RED WAX SEAL --- */}
          <div className="absolute top-[120px] left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-20 h-20 bg-red-600 text-white rounded-full flex items-center justify-center text-4xl shadow-md border-[4px] border-white ring-1 ring-red-200">
            ⚠️
          </div>
          {/* --------------------------- */}

          <div className="relative z-10"><br />
            <h1 className="text-3xl font-['Cormorant_Infant'] font-bold text-stone-800 mb-2">Whoopps!</h1>
            <p className="text-stone-600 mb-8 font-medium">{errorMessage}</p>
            <button 
              onClick={() => navigate('/')}
              className="w-full bg-red-900 text-white py-4 rounded-xl font-bold text-lg active:bg-red-950 transition-colors shadow-lg"
            >
              Return Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}