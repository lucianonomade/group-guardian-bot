import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import LandingPage from "./pages/LandingPage";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Groups from "./pages/Groups";
import GroupMembers from "./pages/GroupMembers";
import Analytics from "./pages/Analytics";
import Warnings from "./pages/Warnings";
import Bans from "./pages/Bans";
import BlockedWords from "./pages/BlockedWords";
import SettingsPage from "./pages/SettingsPage";
import Whitelist from "./pages/Whitelist";
import BroadcastPage from "./pages/BroadcastPage";
import GroupFinder from "./pages/GroupFinder";
import Tutorial from "./pages/Tutorial";
import ValidateNumbers from "./pages/ValidateNumbers";
import NotFound from "./pages/NotFound";
import CheckoutPage from "./pages/CheckoutPage";
import SubscriptionPage from "./pages/SubscriptionPage";
import AdminPage from "./pages/AdminPage";
import ResetPassword from "./pages/ResetPassword";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/dashboard" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/groups" element={<ProtectedRoute><Groups /></ProtectedRoute>} />
            <Route path="/groups/:groupId/members" element={<ProtectedRoute><GroupMembers /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
            <Route path="/broadcast" element={<ProtectedRoute><BroadcastPage /></ProtectedRoute>} />
            <Route path="/warnings" element={<ProtectedRoute><Warnings /></ProtectedRoute>} />
            <Route path="/bans" element={<ProtectedRoute><Bans /></ProtectedRoute>} />
            <Route path="/blocked-words" element={<ProtectedRoute><BlockedWords /></ProtectedRoute>} />
            <Route path="/whitelist" element={<ProtectedRoute><Whitelist /></ProtectedRoute>} />
            <Route path="/group-finder" element={<ProtectedRoute><GroupFinder /></ProtectedRoute>} />
            <Route path="/validate-numbers" element={<ProtectedRoute><ValidateNumbers /></ProtectedRoute>} />
            <Route path="/subscription" element={<ProtectedRoute><SubscriptionPage /></ProtectedRoute>} />
            <Route path="/tutorial" element={<ProtectedRoute><Tutorial /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
