import { useState } from "react";
import { useTheme } from "next-themes";
import { dbOperations } from "@/lib/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface LoginScreenProps {
  onLogin: () => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { theme } = useTheme();

  const handleLogin = async () => {
    setIsLoading(true);
    setError("");
    
    try {
      // In a real app, this would be an API call
      // For demo, just validate locally
      if (username && password) {
        await dbOperations.saveUserCredentials({ username, password });
        onLogin();
      } else {
        setError("Please enter both username and password");
      }
    } catch (err) {
      setError("Login failed. Please try again.");
      console.error("Login error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const bgClass = theme === "dark" 
    ? "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900" 
    : "bg-gradient-to-br from-white via-gray-50 to-white";

  return (
    <div className={`min-h-screen ${bgClass} flex flex-col items-center justify-center p-4 relative overflow-hidden`}>
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-20 w-32 h-32 rounded-full bg-primary/20 animate-pulse"></div>
        <div className="absolute bottom-32 right-16 w-24 h-24 rounded-full bg-primary/15 animate-pulse delay-1000"></div>
      </div>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-background/90 backdrop-blur-md rounded-2xl shadow-xl p-8 border border-border">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img 
              src={theme === 'dark' ? "/lovable-uploads/logo2.png" : "/lovable-uploads/logo1.png"}
              alt="LIFT Company Logo" 
              className="h-32 w-32"
            />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-center mb-2">Field Officer Login</h1>
          <p className="text-muted-foreground text-center mb-8">
            Access your workspace securely
          </p>

          {/* Form */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="mt-1"
              />
            </div>

            {error && (
              <div className="text-destructive text-sm text-center">
                {error}
              </div>
            )}

            <Button
              onClick={handleLogin}
              className="w-full mt-4"
              disabled={isLoading}
            >
              {isLoading ? "Logging in..." : "Login"}
            </Button>
          </div>

          {/* Status badges */}
          <div className="flex flex-wrap justify-center gap-2 mt-8">
            <Badge variant="outline" className="bg-background">
              🔒 Secure Login
            </Badge>
            <Badge variant="outline" className="bg-background">
              📱 Mobile Ready
            </Badge>
          </div>
        </div>

        {/* Bottom branding */}
        <div className="mt-8 text-center text-muted-foreground text-sm">
          <p>Powered by LIFT Financial Solutions</p>
        </div>
      </div>
    </div>
  );
}