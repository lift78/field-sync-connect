import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Simulate loading progress
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 2;
      });
    }, 40);

    const timer = setTimeout(() => {
      onComplete();
    }, 2500);

    return () => {
      clearTimeout(timer);
      clearInterval(progressInterval);
    };
  }, [onComplete]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 flex flex-col items-center justify-center text-white relative overflow-hidden">
      {/* Animated background effects */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-20 left-20 w-40 h-40 rounded-full bg-white/30 animate-pulse blur-2xl"></div>
        <div className="absolute bottom-32 right-16 w-32 h-32 rounded-full bg-white/20 animate-pulse blur-2xl" style={{ animationDelay: '1000ms' }}></div>
        <div className="absolute top-1/2 left-8 w-24 h-24 rounded-full bg-white/25 animate-pulse blur-2xl" style={{ animationDelay: '500ms' }}></div>
        <div className="absolute top-1/3 right-1/4 w-28 h-28 rounded-full bg-white/15 animate-pulse blur-2xl" style={{ animationDelay: '1500ms' }}></div>
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)',
        backgroundSize: '50px 50px'
      }}></div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center px-4">
        {/* Logo with glow effect */}
        <div className="mb-8 relative">
          <div className="absolute inset-0 bg-white/30 rounded-full blur-3xl animate-pulse"></div>
          <div className="relative bg-white/10 backdrop-blur-sm p-6 rounded-3xl border border-white/20 shadow-2xl">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-white/10 rounded-2xl blur-xl"></div>
              <img 
                src="/lovable-uploads/logo2.png" 
                alt="LIFT Company Logo" 
                className="relative h-20 w-20 drop-shadow-2xl"
              />
            </div>
          </div>
        </div>

        {/* Company name with animated gradient */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-3 tracking-tight bg-gradient-to-r from-white via-blue-100 to-white bg-clip-text text-transparent animate-pulse">
            LIFT
          </h1>
          <p className="text-xl opacity-90 font-medium tracking-wide">Field Officer App</p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <div className="h-1 w-1 rounded-full bg-white animate-pulse"></div>
            <p className="text-sm opacity-70">Version 1.0</p>
            <div className="h-1 w-1 rounded-full bg-white animate-pulse"></div>
          </div>
        </div>

        {/* Enhanced status badges */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          <Badge className="bg-white/20 text-white border-white/40 backdrop-blur-sm px-4 py-2 shadow-lg hover:bg-white/30 transition-all">
            📱 Mobile Ready
          </Badge>
          <Badge className="bg-white/20 text-white border-white/40 backdrop-blur-sm px-4 py-2 shadow-lg hover:bg-white/30 transition-all">
            📶 Offline Mode
          </Badge>
          <Badge className="bg-white/20 text-white border-white/40 backdrop-blur-sm px-4 py-2 shadow-lg hover:bg-white/30 transition-all">
            🔒 Secure Sync
          </Badge>
        </div>

        {/* Enhanced loading indicator with progress bar */}
        <div className="w-64 space-y-4">
          {/* Progress bar */}
          <div className="relative h-2 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm border border-white/30">
            <div 
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-white/30 animate-pulse"></div>
            </div>
          </div>

          {/* Loading dots */}
          <div className="flex items-center justify-center space-x-2">
            <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></div>
            <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '400ms' }}></div>
          </div>

          <p className="text-sm opacity-75 text-center font-medium">
            {progress < 30 && "Initializing..."}
            {progress >= 30 && progress < 60 && "Loading resources..."}
            {progress >= 60 && progress < 90 && "Setting up workspace..."}
            {progress >= 90 && "Almost ready..."}
          </p>
        </div>
      </div>

      {/* Bottom branding with brandy colors */}
      <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-3">
        <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-amber-500/30 via-orange-500/30 to-red-500/30 border border-amber-400/40 backdrop-blur-sm shadow-xl">
          <div className="h-2 w-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 animate-pulse shadow-lg"></div>
          <p className="text-sm font-semibold bg-gradient-to-r from-amber-200 via-orange-200 to-red-200 bg-clip-text text-transparent">
            Powered by Spekta
          </p>
        </div>
        <p className="text-xs opacity-50">LIFT Financial Solutions © 2025</p>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        
        .animate-bounce {
          animation: bounce 1s infinite;
        }
      `}</style>
    </div>
  );
}