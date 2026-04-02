import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "404 Not Found | Promnight 2026 Vote Area";
  }, []);

  return (
    <div className="min-h-screen bg-[#e4dcc2] flex items-center justify-center p-4">
      <div className="relative bg-white max-w-md w-full rounded-3xl shadow-xl text-center border border-stone-200 pt-[160px] pb-10 px-8 mt-12">
        
        {/* --- ENVELOPE FLAP EFFECT --- */}
        <div className="absolute inset-0 pointer-events-none rounded-3xl overflow-hidden">
          <svg 
            viewBox="0 0 100 100" 
            preserveAspectRatio="none" 
            className="absolute top-0 left-0 w-full h-[130px] drop-shadow-[0_4px_4px_rgba(0,0,0,0.05)]"
          >
            <polygon points="-10,-10 110,-10 50,100" fill="#f7f7f6" stroke="#e7e5e4" strokeWidth="0.5" />
          </svg>
        </div>

        {/* --- WAX SEAL (404) --- */}
        <div className="absolute top-[130px] left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-20 h-20 bg-red-900 text-amber-300 rounded-full flex items-center justify-center text-3xl font-black shadow-md border-[4px] border-white ring-1 ring-stone-200">
          404
        </div>
        {/* --------------------------- */}

        <div className="relative z-10">
          <h1 className="text-4xl font-['Cormorant_Infant'] font-bold text-red-900 mb-2 py-1">Page Not Found</h1>
          <p className="text-stone-500 mb-8 font-medium text-lg">
            The page you are looking for has vanished into the night.
          </p>
          <button 
            onClick={() => navigate('/')} 
            className="w-full bg-red-900 text-amber-500 py-4 rounded-xl font-bold text-lg shadow-lg active:scale-95 transition-transform"
          >
            Return to Portal
          </button>
        </div>
      </div>
    </div>
  );
}