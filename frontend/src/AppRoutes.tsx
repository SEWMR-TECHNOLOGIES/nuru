// AppRoutes.tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import PrivateRoute from "@/components/PrivateRoute";
import FullPageLoader from "@/components/FullPageLoader";

import Layout from "@/components/Layout";
import Feed from "@/components/Feed";
import Messages from "@/components/Messages";
import MyEvents from "@/components/MyEvents";
import FindServices from "@/components/FindServices";
import Notifications from "@/components/Notifications";
import Help from "@/components/Help";
import Settings from "@/components/Settings";
import MomentDetail from "@/components/MomentDetail";
import CreateEvent from "@/components/CreateEvent";
import EventManagement from "@/components/EventManagement";
import MyServices from "@/components/MyServices";
import AddService from "@/components/AddService";
import EditService from "@/components/EditService";
import ServiceVerification from "@/components/ServiceVerification";
import UserProfile from "@/components/UserProfile";
import ServiceDetail from "@/components/ServiceDetail";
import Circle from "@/components/Circle";
import Communities from "@/components/Communities";
import ProviderChat from "@/components/ProviderChat";
import MyMoments from "@/components/MyMoments";
import LiveChat from "@/components/LiveChat";
import NuruCards from "@/components/NuruCards";

import Index from "@/pages/Index";
import Contact from "@/pages/Contact";
import FAQs from "@/pages/FAQs";
import Register from "@/pages/Register";
import Login from "@/pages/Login";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import Terms from "@/pages/Terms";
import NotFound from "@/pages/NotFound";
import ScrollToTop from "@/components/ScrollToTop";
import EventPlanning from "@/pages/features/EventPlanning";
import ServiceProviders from "@/pages/features/ServiceProviders";
import Invitations from "@/pages/features/Invitations";
import NfcCards from "@/pages/features/NfcCards";
import Payments from "@/pages/features/Payments";
import VerifyEmail from "@/pages/VerifyEmail";
import VerifyPhone from "@/pages/VerifyPhone";

export default function AppRoutes() {
  const { userIsLoggedIn, isLoading } = useCurrentUser();

  if (isLoading) return <FullPageLoader />;
  
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        {/* Root - dynamic landing or workspace */}
        <Route path="/" element={userIsLoggedIn ? <Layout /> : <Index />} />

        {/* Public Pages */}
        <Route path="/contact" element={<Contact />} />
        <Route path="/faqs" element={<FAQs />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/verify-phone" element={<VerifyPhone />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/features/event-planning" element={<EventPlanning />} />
        <Route path="/features/service-providers" element={<ServiceProviders />} />
        <Route path="/features/invitations" element={<Invitations />} />
        <Route path="/features/nfc-cards" element={<NfcCards />} />
        <Route path="/features/payments" element={<Payments />} />

        {/* Protected Pages - nested inside Layout */}
        {userIsLoggedIn && (
          <Route
            path="/"
            element={
              <PrivateRoute userIsLoggedIn={userIsLoggedIn}>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<Feed />} />
            <Route path="messages" element={<Messages />} />
            <Route path="my-events" element={<MyEvents />} />
            <Route path="find-services" element={<FindServices />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="help" element={<Help />} />
            <Route path="settings" element={<Settings />} />
            <Route path="post/:id" element={<MomentDetail />} />
            <Route path="create-event" element={<CreateEvent />} />
            <Route path="event-management/:id" element={<EventManagement />} />
            <Route path="my-services" element={<MyServices />} />
            <Route path="services/new" element={<AddService />} />
            <Route path="services/edit/:id" element={<EditService />} />
            <Route path="services/verify/:serviceId/:serviceType" element={<ServiceVerification />}/>
            <Route path="service/:id" element={<ServiceDetail />} />
            <Route path="profile" element={<UserProfile />} />
            <Route path="circle" element={<Circle />} />
            <Route path="communities" element={<Communities />} />
            <Route path="provider-chat" element={<ProviderChat />} />
            <Route path="my-posts" element={<MyMoments />} />
            <Route path="live-chat" element={<LiveChat />} />
            <Route path="nuru-cards" element={<NuruCards />} />
          </Route>
        )}

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
