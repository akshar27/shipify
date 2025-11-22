import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CreateDelivery from "./pages/CreateDelivery";
import CreateTrip from "./pages/CreateTrip";
import MyDeliveries from "./pages/MyDeliveries";
import MatchTrips from "./pages/MatchTrips";
import MyRequests from "./pages/MyRequests";
import UploadDocument from "./pages/UploadDocument";
import AdminVerify from "./pages/AdminVerify";
import Navbar from "./components/Navbar";
import Admin from "./pages/Admin";
import PaymentSuccess from "./pages/PaymentSuccess";
import { jwtDecode } from "jwt-decode";
import ProfilePage from "./pages/Profile";
import ForgotPassword from "./pages/ForgotPassword";
import EmailVerification from "./components/EmailVerification";
import ResetPassword from "./pages/ResetPassword"; 
import { ChatProvider } from "./context/ChatContext";
import FloatingChatDrawer from "./components/FloatingChatDrawer";
import ResendVerification from "./pages/ResendVerification";
import PublicProfile from "./pages/PublicProfile";

function App() {
  const token = localStorage.getItem("token");
  const user = token ? jwtDecode(token) : null;

  return (
    <ChatProvider>
      <Router>
        <Navbar />
        <FloatingChatDrawer />

        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/create-delivery" element={<CreateDelivery />} />
          <Route path="/create-trip" element={<CreateTrip />} />
          <Route path="/my-deliveries" element={<MyDeliveries />} />
          <Route path="/match/:deliveryId" element={<MatchTrips />} />
          <Route path="/my-requests" element={<MyRequests />} />
          <Route path="/upload-doc" element={<UploadDocument />} />
          <Route path="/admin/verify/:id" element={<AdminVerify />} />
          <Route path="/admin" element={<Admin user={user} />} />
          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/public-profile/:id" element={<PublicProfile />} />

          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/resend-verification" element={<ResendVerification />} />

          {/* IMPORTANT ROUTE */}
          <Route path="/verify-email/:token" element={<EmailVerification />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
        </Routes>
      </Router>
    </ChatProvider>
  );
}

export default App;
