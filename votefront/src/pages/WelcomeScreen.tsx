import { useState, useEffect } from 'react';

interface WelcomeScreenProps {
  onComplete: () => void;
  studentId: string;
}

export default function WelcomeScreen({ onComplete, studentId }: WelcomeScreenProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step === 3) {
      const exitTimer = setTimeout(onComplete, 500);
      return () => clearTimeout(exitTimer);
    }

    const nextStepTimer = setTimeout(() => {
      setStep((prev) => prev + 1);
    }, 3500);

    return () => clearTimeout(nextStepTimer);
  }, [step, onComplete]);

  const waxGradientText = "bg-gradient-to-r from-red-900 via-red-800 to-amber-500 bg-clip-text text-transparent py-4";

  return (
    <div className="fixed inset-0 bg-[#e4dcc2] flex items-center justify-center z-50 overflow-hidden">
      
      <style>
        {`
          .animate-draw {
            stroke-dasharray: 100;
            stroke-dashoffset: 100;
            animation: draw 2s ease-in-out forwards;
          }
          @keyframes draw {
            to { stroke-dashoffset: 0; }
          }
          
          .animate-wipe {
            clip-path: polygon(0 -50%, 0 -50%, 0 150%, 0 150%);
            animation: wipe 2s ease-in-out forwards;
          }
          @keyframes wipe {
            to { clip-path: polygon(0 -50%, 120% -50%, 120% 150%, 0 150%); }
          }
        `}
      </style>

      {/* STEP 0: Hello SVG + Student ID */}
      <div className={`absolute inset-0 flex flex-col items-center justify-center w-full h-full transition-all duration-500 ease-in-out ${step === 0 ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
        {step >= 0 && (
          <>
            <svg 
              className="w-48 md:w-64 drop-shadow-md" 
              viewBox="0 0 1230.94 414.57"
            >
              <defs>
                <linearGradient id="waxGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#7f1d1d" /> 
                  <stop offset="50%" stopColor="#991b1b" /> 
                  <stop offset="100%" stopColor="#f59e0b" /> 
                </linearGradient>
              </defs>
              <path 
                d="M-293.58-104.62S-103.61-205.49-60-366.25c9.13-32.45,9-58.31,0-74-10.72-18.82-49.69-33.21-75.55,31.94-27.82,70.11-52.22,377.24-44.11,322.48s34-176.24,99.89-183.19c37.66-4,49.55,23.58,52.83,47.92a117.06,117.06,0,0,1-3,45.32c-7.17,27.28-20.47,97.67,33.51,96.86,66.93-1,131.91-53.89,159.55-84.49,31.1-36.17,31.1-70.64,19.27-90.25-16.74-29.92-69.47-33-92.79,16.73C62.78-179.86,98.7-93.8,159-81.63S302.7-99.55,393.3-269.92c29.86-58.16,52.85-114.71,46.14-150.08-7.44-39.21-59.74-54.5-92.87-8.7-47,65-61.78,266.62-34.74,308.53S416.62-58,481.52-130.31s133.2-188.56,146.54-256.23c14-71.15-56.94-94.64-88.4-47.32C500.53-375,467.58-229.49,503.3-127a73.73,73.73,0,0,0,23.43,33.67c25.49,20.23,55.1,16,77.46,6.32a111.25,111.25,0,0,0,30.44-19.87c37.73-34.23,29-36.71,64.58-127.53C724-284.3,785-298.63,821-259.13a71,71,0,0,1,13.69,22.56c17.68,46,6.81,80-6.81,107.89-12,24.62-34.56,42.72-61.45,47.91-23.06,4.45-48.37-.35-66.48-24.27a78.88,78.88,0,0,1-12.66-25.8c-14.75-51,4.14-88.76,11-101.41,6.18-11.39,37.26-69.61,103.42-42.24,55.71,23.05,100.66-23.31,100.66-23.31" 
                transform="translate(311.08 476.02)" 
                fill="none" 
                stroke="url(#waxGradient)" 
                strokeLinecap="round" 
                strokeMiterlimit="10" 
                strokeWidth="35px"
                pathLength="100" 
                className="animate-draw"
              />
            </svg>
            <h2 className={`text-4xl md:text-5xl font-['Borel'] mt-[-10px] ${waxGradientText} opacity-0 animate-[fadeIn_1s_ease-in-out_1.5s_forwards] leading-relaxed whitespace-nowrap`}>
              {studentId}
            </h2>
          </>
        )}
      </div>

      {/* STEP 1: Welcome To (Added text-5xl for mobile and whitespace-nowrap) */}
      <div className={`absolute inset-0 flex flex-col items-center justify-center w-full h-full transition-all duration-500 ease-in-out ${step === 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
        {step >= 1 && (
          <h1 className={`text-5xl sm:text-6xl md:text-7xl font-['Borel'] ${waxGradientText} animate-wipe px-4 leading-relaxed whitespace-nowrap`}>
            Welcome to
          </h1>
        )}
      </div>

      {/* STEP 2: Prom Voting Area (Added text-5xl and wrapped "Prom Voting" in whitespace-nowrap) */}
      <div className={`absolute inset-0 flex flex-col items-center justify-center w-full h-full transition-all duration-500 ease-in-out ${step === 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
        {step >= 2 && (
          <h1 className={`text-5xl sm:text-6xl md:text-7xl font-['Borel'] text-center ${waxGradientText} animate-wipe px-4 leading-relaxed`}>
            <span className="whitespace-nowrap">Prom Voting</span> <br /> Area
          </h1>
        )}
      </div>

    </div>
  );
}