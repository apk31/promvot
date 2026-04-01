import { useState } from 'react';
import type { Category, Nominee, VoteSelection } from '../types';

interface Props {
  categories: Category[];
  onSubmit: (finalVotes: VoteSelection[]) => void;
}

export default function VotingCarousel({ categories, onSubmit }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [selections, setSelections] = useState<Record<number, Nominee>>({});
  const [isReviewing, setIsReviewing] = useState(false);
  const [isEditingFromReview, setIsEditingFromReview] = useState(false); 

  const totalSteps = categories.length;
  const currentCategory = categories[currentStep];

  const handleSelect = (nominee: Nominee) => {
    setSelections((prev) => ({ ...prev, [currentCategory.category_id]: nominee }));
    setTimeout(() => {
      if (isEditingFromReview) {
        setIsReviewing(true);
        setIsEditingFromReview(false);
      } else if (currentStep < totalSteps - 1) {
        setCurrentStep(currentStep + 1);
      } else {
        setIsReviewing(true);
      }
    }, 300);
  };

  // --- REVIEW SCREEN ---
  if (isReviewing) {
    return (
      <div className="max-w-md mx-auto p-4 pb-24 min-h-[100dvh] bg-[#FCFBF8] pt-6 sm:pt-8">
        <h2 className="text-4xl font-['Cormorant_Infant'] text-red-900 mb-6 text-center font-bold">Review Your Vote</h2>
        <div className="space-y-3 sm:space-y-4">
          {categories.map((cat) => {
            const selectedNominee = selections[cat.category_id];
            return (
              <div key={cat.category_id} className="bg-white p-3 sm:p-4 rounded-2xl shadow-sm border border-stone-200 flex items-center gap-3 sm:gap-4">
                <img 
                  src={selectedNominee?.photo_url || '/img/dummy.jpg'} 
                  alt={selectedNominee?.name || 'Nominee'}
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover shrink-0 border border-stone-200 shadow-sm"
                />
                <div className="flex-1">
                  <p className="text-[10px] sm:text-xs text-amber-600 uppercase font-bold tracking-wider">{cat.category_name}</p>
                  <p className="text-base sm:text-lg font-bold text-stone-800 leading-tight">{selectedNominee?.name}</p>
                </div>
                <button 
                  onClick={() => { 
                    setIsReviewing(false); 
                    setIsEditingFromReview(true);
                    setCurrentStep(categories.indexOf(cat)); 
                  }}
                  className="text-red-900 text-xs sm:text-sm font-bold px-3 py-2 sm:px-4 bg-red-50 rounded-lg active:bg-red-100 border border-red-100"
                >
                  Edit
                </button>
              </div>
            );
          })}
        </div>
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-stone-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="max-w-md mx-auto">
            <button 
              onClick={() => {
                const finalPayload = Object.entries(selections).map(([catId, nominee]) => ({
                  category_id: parseInt(catId),
                  nominee_id: nominee.id
                }));
                onSubmit(finalPayload);
              }}
              className="w-full bg-red-900 text-amber-500 py-3.5 sm:py-4 rounded-2xl font-black text-lg sm:text-xl shadow-lg shadow-red-900/20 active:scale-95 transition-transform"
            >
              Cast My Vote
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- VOTING STEP SCREEN ---
  return (
    // Replaced min-h-screen with min-h-[100dvh] so the mobile URL bar doesn't cut off the footer
    <div className="max-w-md mx-auto p-4 flex flex-col min-h-[100dvh] bg-[#FCFBF8] pt-4 sm:pt-8">
      
      {/* Reduced bottom margin on mobile */}
      <div className="mb-4 sm:mb-8">
        <div className="flex justify-between items-end mb-2">
          <span className="text-[10px] sm:text-xs font-black text-amber-600 uppercase tracking-widest">
            {isEditingFromReview ? 'Editing Category' : `Category ${currentStep + 1} of ${totalSteps}`}
          </span>
          {!isEditingFromReview && (
            <span className="text-xs text-stone-400 font-bold">
              {Math.round(((currentStep + 1) / totalSteps) * 100)}%
            </span>
          )}
        </div>
        {!isEditingFromReview && (
          <div className="h-1.5 sm:h-2 w-full bg-stone-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-red-900 transition-all duration-500 ease-out" 
              style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
            />
          </div>
        )}
      </div>

      <h2 className="text-2xl sm:text-3xl font-black text-stone-800 mb-4 sm:mb-8 leading-tight">
        {currentCategory.category_name}
      </h2>

      {/* Reduced space between cards on mobile */}
      <div className="space-y-3 sm:space-y-4 flex-1">
        {currentCategory.nominees.map((nominee) => {
          const isSelected = selections[currentCategory.category_id]?.id === nominee.id;
          return (
            <button
              key={nominee.id}
              onClick={() => handleSelect(nominee)}
              className={`w-full text-left p-3 sm:p-4 rounded-2xl border-2 transition-all duration-200 flex items-center gap-3 sm:gap-4 shadow-sm ${
                isSelected
                  ? 'border-amber-500 bg-red-50 shadow-md scale-[1.02]'
                  : 'border-transparent bg-white active:bg-stone-50 active:scale-[0.98]'
              }`}
            >
              <img 
                src={nominee.photo_url || '/img/dummy.jpg'} 
                alt={nominee.name}
                // Image scales down to 80px (w-20) on small screens, back to 96px (w-24) on normal ones
                className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover shrink-0 shadow-sm transition-all duration-200 ${
                  isSelected ? 'border-2 border-amber-500' : 'border border-stone-100'
                }`}
              />
              <div className="flex-1 py-1">
                {/* Text uses text-base leading-tight to save lines, scales up to text-lg on normal screens */}
                <span className={`text-base sm:text-lg font-bold leading-tight block ${
                  isSelected ? 'text-red-900' : 'text-stone-800'
                }`}>
                  {nominee.name}
                </span>
              </div>
              <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 ${
                isSelected ? 'bg-red-900 text-amber-400 opacity-100 scale-100' : 'bg-stone-100 text-transparent opacity-0 scale-50'
              }`}>
                <span className="text-sm sm:text-base">✓</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer margins tightened for small screens */}
      <div className="mt-4 sm:mt-8 mb-2 sm:mb-6 flex justify-between gap-3 sm:gap-4">
        {isEditingFromReview ? (
          <button 
            onClick={() => { setIsReviewing(true); setIsEditingFromReview(false); }}
            className="w-full py-3.5 sm:py-4 bg-stone-200 text-stone-700 rounded-xl font-bold active:bg-stone-300 transition-colors"
          >
            Cancel Edit
          </button>
        ) : (
          <>
            <button 
              disabled={currentStep === 0}
              onClick={() => setCurrentStep(currentStep - 1)}
              className="px-4 sm:px-6 py-3.5 sm:py-4 rounded-xl font-bold text-stone-400 disabled:opacity-0 active:bg-stone-200 transition-colors"
            >
              ← Back
            </button>
            {selections[currentCategory.category_id] && (
               <button 
               onClick={() => currentStep < totalSteps - 1 ? setCurrentStep(currentStep + 1) : setIsReviewing(true)}
               className="px-6 sm:px-8 py-3.5 sm:py-4 bg-red-900 text-amber-500 rounded-xl font-bold shadow-lg active:scale-95 transition-transform"
             >
               {currentStep < totalSteps - 1 ? 'Next →' : 'Review Vote'}
             </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}