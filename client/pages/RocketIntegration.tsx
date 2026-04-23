import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/auth/AuthProvider";

export default function RocketIntegration() {
    const navigate = useNavigate();
    const { user, updateUser } = useAuth();
    const [rocketUserToken, setRocketUserToken] = useState("");
    const [rocketUserId, setRocketUserId] = useState("");
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
        <DashboardLayout
            title="Rocket Integration"
            subtitle={user ? `Connect Rocket.Chat for ${user.email}` : "Connect your Rocket.Chat account"}
            showHeaderControls={false}
        >
            <div className="min-h-[calc(100vh-14rem)] flex items-center justify-center">
                <div className="light-card rounded-2xl p-8 animate-fade-in w-full max-w-2xl">
                    <div className="flex items-start gap-4 mb-8">
                        <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                            <ShieldCheck className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-card-light-foreground">Secure Rocket.Chat Setup</h2>
                            <p className="text-sm text-muted-foreground mt-2">
                                Paste your Rocket.Chat user token and user id. They will be encrypted before being stored in MongoDB.
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label htmlFor="rocketUserToken" className="text-sm font-medium text-card-light-foreground">
                                Rocket user token
                            </label>
                            <Input
                                id="rocketUserToken"
                                type="password"
                                value={rocketUserToken}
                                onChange={(event) => setRocketUserToken(event.target.value)}
                                placeholder="Paste your Rocket.Chat user token"
                                className="h-12"
                                autoComplete="off"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="rocketUserId" className="text-sm font-medium text-card-light-foreground">
                                Rocket user id
                            </label>
                            <Input
                                id="rocketUserId"
                                type="text"
                                value={rocketUserId}
                                onChange={(event) => setRocketUserId(event.target.value)}
                                placeholder="Paste your Rocket.Chat user id"
                                className="h-12"
                                autoComplete="off"
                                required
                            />
                        </div>

                        <div className="flex items-center gap-3">
                            <Button type="submit" className="h-12 px-6" disabled={isSaving}>
                                {isSaving ? "Saving..." : "Save integration"}
                            </Button>
                            <p className="text-sm text-muted-foreground">
                                You will be redirected to the home page after the credentials are saved.
                            </p>
                        </div>
                    </form>
                </div>
            </div>
        </DashboardLayout>
    );
}
