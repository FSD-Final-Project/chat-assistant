import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/auth/AuthProvider";

export default function RocketIntegration() {
    const navigate = useNavigate();
    const { user, updateUser } = useAuth();
    const [rocketUserToken, setRocketUserToken] = useState("");
    const [rocketUserId, setRocketUserId] = useState("");
    const [showRocketUserToken, setShowRocketUserToken] = useState(false);
    const [showRocketUserId, setShowRocketUserId] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsSaving(true);

        try {
            const response = await fetch("/users/me/rocket-integration", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    rocketUserToken,
                    rocketUserId,
                }),
            });

            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload.message ?? "Failed to save Rocket.Chat integration");
            }

            updateUser(payload.user);
            toast({
                title: "Rocket.Chat connected",
                description: "Your Rocket.Chat credentials were saved securely.",
            });
            navigate("/");
        } catch (error) {
            const description = error instanceof Error ? error.message : "Failed to save Rocket.Chat integration";
            toast({
                title: "Save failed",
                description,
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <main className="min-h-screen px-4 py-10 sm:px-6 flex items-center justify-center">
            <div className="light-card rounded-2xl p-8 animate-fade-in w-full max-w-2xl">
                <div className="flex items-start gap-4 mb-8">
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                        <ShieldCheck className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-primary mb-2">Rocket Integration</p>
                        <h1 className="text-xl font-bold text-card-light-foreground">Secure Rocket.Chat Setup</h1>
                        <p className="text-sm text-muted-foreground mt-2">
                            {user ? `Connect Rocket.Chat for ${user.email}. ` : ""}
                            Paste your Rocket.Chat user token and user id. They will be encrypted before being stored in MongoDB.
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label htmlFor="rocketUserToken" className="text-sm font-medium text-card-light-foreground">
                            Rocket user token
                        </label>
                        <div className="relative">
                            <Input
                                id="rocketUserToken"
                                type={showRocketUserToken ? "text" : "password"}
                                value={rocketUserToken}
                                onChange={(event) => setRocketUserToken(event.target.value)}
                                placeholder="Paste your Rocket.Chat user token"
                                className="h-12 pr-12 text-white"
                                autoComplete="off"
                                required
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-1 top-1 h-10 w-10 text-muted-foreground hover:text-white"
                                aria-label={showRocketUserToken ? "Hide Rocket user token" : "Show Rocket user token"}
                                onClick={() => setShowRocketUserToken((current) => !current)}
                            >
                                {showRocketUserToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="rocketUserId" className="text-sm font-medium text-card-light-foreground">
                            Rocket user id
                        </label>
                        <div className="relative">
                            <Input
                                id="rocketUserId"
                                type={showRocketUserId ? "text" : "password"}
                                value={rocketUserId}
                                onChange={(event) => setRocketUserId(event.target.value)}
                                placeholder="Paste your Rocket.Chat user id"
                                className="h-12 pr-12 text-white"
                                autoComplete="off"
                                required
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-1 top-1 h-10 w-10 text-muted-foreground hover:text-white"
                                aria-label={showRocketUserId ? "Hide Rocket user id" : "Show Rocket user id"}
                                onClick={() => setShowRocketUserId((current) => !current)}
                            >
                                {showRocketUserId ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <Button type="submit" className="h-12 px-6" disabled={isSaving}>
                            {isSaving ? "Saving..." : "Save integration"}
                        </Button>
                        <p className="text-sm text-muted-foreground">
                            You will be redirected to the home page after the credentials are saved.
                        </p>
                    </div>
                </form>
            </div>
        </main>
    );
}
