import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { LoaderCircle } from 'lucide-react';

export default function Login() {
  const {
    isAuthenticated,
    isLoading,
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
  } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get('error');

    if (authError) {
      toast({
        title: 'Authentication failed',
        description: authError,
        variant: 'destructive',
      });
      window.history.replaceState({}, '', '/login');
    }
  }, []);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleEmailAuth = async () => {
    if (!email.trim() || !password.trim()) {
      toast({
        title: 'Missing fields',
        description: 'Email and password are required.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'register') {
        await registerWithEmail(
          email.trim(),
          password,
          name.trim() || undefined
        );
      } else {
        await signInWithEmail(email.trim(), password);
      }
    } catch (error) {
      toast({
        title: mode === 'register' ? 'Registration failed' : 'Sign in failed',
        description:
          error instanceof Error ? error.message : 'Authentication failed',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="glass-card rounded-2xl p-8 animate-scale-in">
          <h1 className="text-2xl font-bold text-center text-foreground mb-2">
            {mode === 'register'
              ? 'Create your account'
              : 'Sign in to continue'}
          </h1>
          <h2 className="text-2xl font-bold text-center text-foreground mb-8">
            Chat Assistant
          </h2>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${mode === 'login' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
              >
                Email login
              </button>
              <button
                type="button"
                onClick={() => setMode('register')}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${mode === 'register' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
              >
                Register
              </button>
            </div>

            {mode === 'register' ? (
              <Input
                placeholder="Full name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            ) : null}
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />

            <Button
              type="button"
              className="h-12 w-full rounded-xl font-semibold"
              onClick={() => void handleEmailAuth()}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  {mode === 'register' ? 'Creating account' : 'Signing in'}
                </>
              ) : mode === 'register' ? (
                'Create account'
              ) : (
                'Sign in with email'
              )}
            </Button>

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  or
                </span>
              </div>
            </div>

            <div className="flex justify-center">
              <Button
                type="button"
                variant="secondary"
                className="h-12 rounded-full px-8 font-semibold"
                onClick={signInWithGoogle}
              >
                Continue with Google
              </Button>
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Checking session
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
