// AppRoutes.tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuthSync } from "@/hooks/useAuthSync";
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
import PostDetail from "@/components/PostDetail";
import CreateEvent from "@/components/CreateEvent";
import EventManagement from "@/components/EventManagement";
import MyServices from "@/components/MyServices";
import AddService from "@/components/AddService";
import EditService from "@/components/EditService";
import ServiceVerification from "@/components/ServiceVerification";
import UserProfile from "@/components/UserProfile";
import ServiceDetail from "@/components/ServiceDetail";
import PublicServiceDetail from "@/components/PublicServiceDetail";
import Circle from "@/components/Circle";
import Communities from "@/components/Communities";
import ProviderChat from "@/components/ProviderChat";
import CommunityDetail from "@/components/CommunityDetail";
import MyMoments from "@/components/MyMoments";
import MyContributors from "@/components/MyContributors";
import SavedPosts from "@/components/SavedPosts";
import RemovedContent from "@/components/RemovedContent";
import LiveChat from "@/components/LiveChat";
import NuruCards from "@/components/NuruCards";
import BookingList from "@/components/bookings/BookingList";
import BookingDetail from "@/components/bookings/BookingDetail";
import EventView from "@/components/EventView";
import PublicProfile from "@/components/PublicProfile";
import ServiceEventsPage from "@/components/ServiceEventsPage";
import ServicePhotoLibraries from "@/components/ServicePhotoLibraries";
import PhotoLibraryDetail from "@/components/PhotoLibraryDetail";
import SharedPhotoLibrary from "@/components/SharedPhotoLibrary";

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
import ResetPassword from "@/pages/ResetPassword";
import GuestPost from "@/pages/GuestPost";
import RSVPConfirmation from "@/pages/RSVPConfirmation";
import ChangePassword from "@/pages/ChangePassword";

// Admin
import AdminLogin from "@/pages/admin/AdminLogin";
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminKyc from "@/pages/admin/AdminKyc";
import AdminServices from "@/pages/admin/AdminServices";
import AdminEvents from "@/pages/admin/AdminEvents";
import AdminEventDetail from "@/pages/admin/AdminEventDetail";
import AdminEventTypes from "@/pages/admin/AdminEventTypes";
import AdminChats from "@/pages/admin/AdminChats";
import AdminChatDetail from "@/pages/admin/AdminChatDetail";
import AdminTickets from "@/pages/admin/AdminTickets";
import AdminFaqs from "@/pages/admin/AdminFaqs";
import AdminNotifications from "@/pages/admin/AdminNotifications";
import AdminPosts from "@/pages/admin/AdminPosts";
import AdminPostDetail from "@/pages/admin/AdminPostDetail";
import AdminMoments from "@/pages/admin/AdminMoments";
import AdminMomentDetail from "@/pages/admin/AdminMomentDetail";
import AdminCommunities from "@/pages/admin/AdminCommunities";
import AdminCommunityDetail from "@/pages/admin/AdminCommunityDetail";
import AdminBookings from "@/pages/admin/AdminBookings";
import AdminNuruCards from "@/pages/admin/AdminNuruCards";
import AdminServiceCategories from "@/pages/admin/AdminServiceCategories";
import AdminAdmins from "@/pages/admin/AdminAdmins";
import AdminUserVerifications from "@/pages/admin/AdminUserVerifications";
import AdminKycDetail from "@/pages/admin/AdminKycDetail";
import AdminServiceDetail from "@/pages/admin/AdminServiceDetail";
import AdminAppeals from "@/pages/admin/AdminAppeals";

// Inner component that uses router hooks (must be inside BrowserRouter)

function InnerRoutes() {
  const { userIsLoggedIn, isLoading } = useCurrentUser();
  useAuthSync(); // safe here — inside BrowserRouter context

  if (isLoading) return <FullPageLoader />;

  return (
    <>
      <ScrollToTop />
      <Routes>
        {/* Root: marketing landing when logged out; app feed when logged in */}
        <Route
          path="/"
          element={userIsLoggedIn ? (
            <Layout>
              <Feed />
            </Layout>
          ) : (
            <Index />
          )}
        />

        {/* Protected app pages */}
        <Route
          element={
            <PrivateRoute userIsLoggedIn={userIsLoggedIn}>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route path="/messages" element={<Messages />} />
          <Route path="/my-events" element={<MyEvents />} />
          <Route path="/find-services" element={<FindServices />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/help" element={<Help />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/post/:id" element={<PostDetail />} />
          <Route path="/create-event" element={<CreateEvent />} />
          <Route path="/event-management/:id" element={<EventManagement />} />
          <Route path="/my-services" element={<MyServices />} />
          <Route path="/services/new" element={<AddService />} />
          <Route path="/services/edit/:id" element={<EditService />} />
          <Route path="/services/verify/:serviceId/:serviceType" element={<ServiceVerification />} />
          <Route path="/service/:id" element={<ServiceDetail />} />
          <Route path="/services/view/:id" element={<PublicServiceDetail />} />
          <Route path="/profile" element={<UserProfile />} />
          <Route path="/circle" element={<Circle />} />
          <Route path="/communities" element={<Communities />} />
          <Route path="/communities/:id" element={<CommunityDetail />} />
          <Route path="/provider-chat" element={<ProviderChat />} />
          <Route path="/my-posts" element={<MyMoments />} />
          <Route path="/saved-posts" element={<SavedPosts />} />
          <Route path="/live-chat" element={<LiveChat />} />
          <Route path="/nuru-cards" element={<NuruCards />} />
          <Route path="/bookings" element={<BookingList />} />
          <Route path="/bookings/:id" element={<BookingDetail />} />
          <Route path="/event/:id" element={<EventView />} />
          <Route path="/my-contributors" element={<MyContributors />} />
          <Route path="/change-password" element={<ChangePassword />} />
          <Route path="/removed-content" element={<RemovedContent />} />
          <Route path="/u/:username" element={<PublicProfile />} />
          <Route path="/services/events/:serviceId" element={<ServiceEventsPage />} />
          <Route path="/services/photo-libraries/:serviceId" element={<ServicePhotoLibraries />} />
          <Route path="/photo-library/:libraryId" element={<PhotoLibraryDetail />} />
        </Route>

        {/* Public Pages */}
        <Route path="/contact" element={<Contact />} />
        <Route path="/faqs" element={<FAQs />} />
        <Route path="/register" element={userIsLoggedIn ? <Navigate to="/" replace /> : <Register />} />
        <Route path="/login" element={userIsLoggedIn ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/verify-phone" element={<VerifyPhone />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/shared/post/:id" element={<GuestPost />} />
        <Route path="/shared/photo-library/:token" element={<SharedPhotoLibrary />} />
        <Route path="/rsvp/:code" element={<RSVPConfirmation />} />
        <Route path="/features/event-planning" element={<EventPlanning />} />
        <Route path="/features/service-providers" element={<ServiceProviders />} />
        <Route path="/features/invitations" element={<Invitations />} />
        <Route path="/features/nfc-cards" element={<NfcCards />} />
        <Route path="/features/payments" element={<Payments />} />

        {/* Admin Panel */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="kyc" element={<AdminKyc />} />
          <Route path="services" element={<AdminServices />} />
          <Route path="events" element={<AdminEvents />} />
          <Route path="events/:id" element={<AdminEventDetail />} />
          <Route path="event-types" element={<AdminEventTypes />} />
          <Route path="chats" element={<AdminChats />} />
          <Route path="chats/:chatId" element={<AdminChatDetail />} />
          <Route path="tickets" element={<AdminTickets />} />
          <Route path="faqs" element={<AdminFaqs />} />
          <Route path="notifications" element={<AdminNotifications />} />
          <Route path="posts" element={<AdminPosts />} />
          <Route path="posts/:id" element={<AdminPostDetail />} />
          <Route path="moments" element={<AdminMoments />} />
          <Route path="moments/:id" element={<AdminMomentDetail />} />
          <Route path="communities" element={<AdminCommunities />} />
          <Route path="communities/:id" element={<AdminCommunityDetail />} />
          <Route path="bookings" element={<AdminBookings />} />
          <Route path="nuru-cards" element={<AdminNuruCards />} />
          <Route path="service-categories" element={<AdminServiceCategories />} />
          <Route path="admins" element={<AdminAdmins />} />
          <Route path="user-verifications" element={<AdminUserVerifications />} />
          <Route path="kyc/:id" element={<AdminKycDetail />} />
          <Route path="services/:id" element={<AdminServiceDetail />} />
          <Route path="appeals" element={<AdminAppeals />} />
        </Route>


        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

export default function AppRoutes() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <InnerRoutes />
    </BrowserRouter>
  );
}
