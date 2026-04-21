import { Home, BarChart3, TrendingUp, Settings, LogOut, ChevronDown } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
    const { user, signOut } = useAuth();

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

    return (
        <aside className="left-0 top-0 h-screen w-[18rem] bg-sidebar flex flex-col border-r border-sidebar-border">
            {/* User Profile */}
            <div className="p-6">
                <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 border-2 border-primary/30">
                        <AvatarImage src={user?.picture} />
                        <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                        <div className="flex items-center gap-1">
                            <span className="font-semibold text-sidebar-foreground">{user?.name ?? "Workspace User"}</span>
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <span className="text-sm text-muted-foreground">{user?.email ?? "No email available"}</span>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4">
                <ul className="space-y-2">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <li key={item.path}>
                                <Link
                                    to={item.path}
                                    className={cn(
                                        "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                                        isActive
                                            ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                                            : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
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

            {/* Logout */}
            <div className="p-4 border-t border-sidebar-border">
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-sidebar-foreground transition-colors w-full"
                >
                    <LogOut className="h-5 w-5" />
                    <span>Log Out</span>
                </button>
            </div>
        </aside>
    );
}
