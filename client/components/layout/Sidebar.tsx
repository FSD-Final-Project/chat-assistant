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
        <aside className="sticky top-0 hidden h-screen w-[15.5rem] shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex xl:w-[17rem]">
            <div className="p-5 xl:p-6">
                <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 border-2 border-primary/30">
                        <AvatarImage src={user?.picture} />
                        <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                            <span className="truncate font-semibold text-sidebar-foreground">
                                {user?.name ?? "Workspace User"}
                            </span>
                            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
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
