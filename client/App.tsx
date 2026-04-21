import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Sidebar } from "./components/layout/Sidebar";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import './App.css'
import TodaySummary from "./pages/TodaySummery";
import ActiveChats from "./pages/ActiveChats";
import HistoryStatistics from "./pages/HistoryStatistics";
import Preferences from "./pages/Preferences";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center text-muted-foreground">
                Loading session...
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return children;
};

const AppContent = () => {
    const location = useLocation();
    const { isAuthenticated, isLoading } = useAuth();
    const showSidebar = isAuthenticated && !["/login"].includes(location.pathname);

    return (
        <div className="min-h-screen bg-background flex">
            {showSidebar && <Sidebar />}
            <div className="p-8 w-full">
                <Routes>
                    <Route path="/" element={<ProtectedRoute><TodaySummary /></ProtectedRoute>} />
                    <Route path="/active-chats" element={<ProtectedRoute><ActiveChats /></ProtectedRoute>} />
                    <Route path="/history" element={<ProtectedRoute><HistoryStatistics /></ProtectedRoute>} />
                    <Route path="/preferences" element={<ProtectedRoute><Preferences /></ProtectedRoute>} />
                    <Route path="/login" element={isLoading ? <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading session...</div> : <Login />} />
                    <Route path="*" element={<NotFound />} />
                </Routes>
            </div>
        </div>
    );
}

const App = () => (
    <QueryClientProvider client={queryClient}>
        <TooltipProvider>
            <Toaster />
            <Sonner />
            <AuthProvider>
                <BrowserRouter>
                    <AppContent />
                </BrowserRouter>
            </AuthProvider>
        </TooltipProvider>
    </QueryClientProvider>
);

export default App;
