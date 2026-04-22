import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { LoaderCircle } from "lucide-react";

export default function Login() {
    const { isAuthenticated, isLoading, signInWithGoogle } = useAuth();

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const authError = params.get("error");

        if (authError) {
            toast({
                title: "Authentication failed",
                description: authError,
                variant: "destructive",
            });
            window.history.replaceState({}, "", "/login");
        }
    }, []);

    if (isAuthenticated) {
        return <Navigate to="/" replace />;
    }

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="glass-card rounded-2xl p-8 animate-scale-in">
                    <h1 className="text-2xl font-bold text-center text-foreground mb-2">
                        Continue With
                    </h1>
                    <h2 className="text-2xl font-bold text-center text-foreground mb-8">
                        Google Workspace
                    </h2>

                    <div className="space-y-4">
                        <p className="text-center text-muted-foreground text-sm">
                            Sign in with Google through the backend session to access your chat analytics dashboard.
                        </p>
                        <div className="flex justify-center">
                            <Button type="button" className="h-12 rounded-full px-8 font-semibold" onClick={signInWithGoogle}>
                                Continue with Google
                            </Button>
                        </div>
                        {isLoading ? (
                            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                                <LoaderCircle className="h-4 w-4 animate-spin" />
                                Checking session
                            </div>
                        ) : null}
                        <Button type="button" variant="secondary" className="w-full h-12 rounded-xl font-semibold" disabled>
                            Email/password login disabled
                        </Button>
                    </div>
                </div>

                {/* Logo */}
                <div className="flex justify-center mt-8">
                    <div className="h-14 w-14 rounded-full bg-gradient-to-br from-primary via-purple-500 to-pink-500 flex items-center justify-center animate-pulse">
                        <span className="text-sm font-bold text-white">αXon</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
