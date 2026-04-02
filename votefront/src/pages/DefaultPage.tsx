import { useEffect } from 'react';

export default function DefaultPage() {
  useEffect(() => {
    document.title = "Denied | Promnight 2026 Vote Area";
  }, []);

  return (
    <div className="min-h-screen bg-[#e4dcc2] flex items-center justify-center p-4">
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

        {/* --- WAX SEAL (LOCK) --- */}
        <div className="absolute top-[120px] left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-16 h-16 bg-red-700 text-white rounded-full flex items-center justify-center text-2xl shadow-lg border-[4px] border-white ring-1 ring-stone-100">
          🔒
        </div>
        {/* --------------------------- */}

        <div className="relative z-10">
          <h1 className="text-3xl font-['Cormorant_Infant'] font-bold text-gray-800 mb-2">Access Denied</h1>
          <p className="text-stone-500 mb-6 font-medium">
            Voting can only be accessed via secure magic links.
          </p>
          <div className="bg-[#f7f7f6] border border-stone-200 rounded-2xl p-5 mb-6">
            <p className="text-sm text-stone-600 font-bold">
              Please ask your class leader for your unique voting link to access this portal.
            </p>
          </div>
          <p className="text-stone-500 italic text-sm">
            See nominee profiles on our <a href="https://www.instagram.com/promkosayu26/" className="text-red-800 font-bold hover:underline">Instagram</a>
          </p>
        </div>
      </div>
    </div>
  );
}