import { useState } from "react";
import { Home, BarChart3, TrendingUp, Settings, LogOut, ChevronDown, KeyRound } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const navItems = [
    { icon: Home, label: "Today Summary", path: "/" },
    { icon: BarChart3, label: "Top - Active Chat's", path: "/active-chats" },
    { icon: TrendingUp, label: "History Statistic", path: "/history" },
    { icon: Settings, label: "Preferences", path: "/preferences" },
];

export function Sidebar() {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, signOut, updateUser } = useAuth();
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isResettingRocketUser, setIsResettingRocketUser] = useState(false);

    const initials = user?.name
        ?.split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() ?? "U";

    const handleLogout = async () => {
        await signOut();
        navigate("/login");
    };

    const handleChangeRocketUser = async () => {
        setIsResettingRocketUser(true);

        try {
            const response = await fetch("/users/me/rocket-integration/reset", {
                method: "POST",
                credentials: "include",
            });
            const payload = (await response.json()) as {
                message?: string;
                user?: typeof user;
            };

            if (!response.ok) {
                throw new Error(payload.message ?? "Failed to reset Rocket user");
            }

            updateUser(payload.user ?? (user ? { ...user, hasRocketIntegration: false } : null));
            setIsUserMenuOpen(false);
            navigate("/rocket-integration");
        } catch (error) {
            toast({
                title: "Failed to change Rocket user",
                description: error instanceof Error ? error.message : "Failed to reset Rocket credentials.",
                variant: "destructive",
            });
        } finally {
            setIsResettingRocketUser(false);
        }
    };

    return (
        <aside className="sticky top-0 hidden h-screen w-[15.5rem] shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex xl:w-[17rem]">
            <div className="p-5 xl:p-6">
                <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 border-2 border-primary/30">
                        <AvatarImage src={user?.picture} />
                        <AvatarFallback seed={user?.name ?? user?.email ?? initials}>{initials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                            <span className="truncate font-semibold text-sidebar-foreground">
                                {user?.name ?? "Workspace User"}
                            </span>
                            <Popover open={isUserMenuOpen} onOpenChange={setIsUserMenuOpen}>
                                <PopoverTrigger asChild>
                                    <button
                                        type="button"
                                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                                        aria-label="Open user menu"
                                    >
                                        <ChevronDown className="h-4 w-4" />
                                    </button>
                                </PopoverTrigger>
                                <PopoverContent align="start" side="bottom" className="w-56 border-sidebar-border bg-sidebar p-2 text-sidebar-foreground">
                                    <button
                                        type="button"
                                        onClick={() => void handleChangeRocketUser()}
                                        disabled={isResettingRocketUser}
                                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground disabled:pointer-events-none disabled:opacity-60"
                                    >
                                        <KeyRound className="h-4 w-4" />
                                        <span>{isResettingRocketUser ? "Resetting..." : "Change Rocket user"}</span>
                                    </button>
                                </PopoverContent>
                            </Popover>
                        </div>
                        <span className="block truncate text-sm text-muted-foreground">
                            {user?.email ?? "No email available"}
                        </span>
                    </div>
                </div>
            </div>

            <nav className="flex-1 px-3 xl:px-4">
                <ul className="space-y-2">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <li key={item.path}>
                                <Link
                                    to={item.path}
                                    className={cn(
                                        "flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-all duration-200 xl:px-4",
                                        isActive
                                            ? "bg-sidebar-accent font-medium text-sidebar-foreground"
                                            : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                                    )}
                                >
                                    <item.icon className="h-5 w-5" />
                                    <span>{item.label}</span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            <div className="border-t border-sidebar-border p-4">
                <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 px-3 py-3 text-sm text-muted-foreground transition-colors hover:text-sidebar-foreground xl:px-4"
                >
                    <LogOut className="h-5 w-5" />
                    <span>Log Out</span>
                </button>
            </div>
        </aside>
    );
}
