import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 2500); // Show for 2.5 seconds

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary/90 to-primary/80 flex flex-col items-center justify-center text-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-20 w-32 h-32 rounded-full bg-white/20 animate-pulse"></div>
        <div className="absolute bottom-32 right-16 w-24 h-24 rounded-full bg-white/15 animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-8 w-16 h-16 rounded-full bg-white/25 animate-pulse delay-500"></div>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center animate-fade-in">
        {/* Logo */}
        <div className="mb-8 animate-scale-in">
          <div className="relative">
            <div className="absolute inset-0 bg-white/20 rounded-full blur-xl animate-pulse"></div>
            <img 
              src="/lovable-uploads/1a913f01-4cbe-458f-b154-186d6ef7d8e3.png" 
              alt="LIFT Company Logo" 
              className="relative h-24 w-24 mx-auto mb-4 drop-shadow-lg"
            />
          </div>
        </div>

        {/* Company name */}
        <div className="text-center mb-6 animate-fade-in delay-300">
          <h1 className="text-4xl font-bold mb-2 tracking-wide">LIFT</h1>
          <p className="text-lg opacity-90 font-medium">Field Officer App</p>
        </div>

        {/* Status badges */}
        <div className="flex flex-col sm:flex-row gap-3 animate-fade-in delay-500">
          <Badge variant="outline" className="bg-white/20 text-white border-white/30 px-4 py-2">
            📱 Mobile Ready
          </Badge>
          <Badge variant="outline" className="bg-white/20 text-white border-white/30 px-4 py-2">
            🔄 Offline Mode
          </Badge>
          <Badge variant="outline" className="bg-white/20 text-white border-white/30 px-4 py-2">
            🔒 Secure Sync
          </Badge>
        </div>

        {/* Loading indicator */}
        <div className="mt-8 animate-fade-in delay-700">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-white rounded-full animate-pulse delay-200"></div>
            <div className="w-2 h-2 bg-white rounded-full animate-pulse delay-400"></div>
          </div>
          <p className="text-sm mt-2 opacity-75 text-center">Loading your workspace...</p>
        </div>
      </div>

      {/* Bottom branding */}
      <div className="absolute bottom-8 left-0 right-0 text-center animate-fade-in delay-1000">
        <p className="text-sm opacity-60">Powered by LIFT Financial Solutions</p>
      </div>
    </div>
  );
}