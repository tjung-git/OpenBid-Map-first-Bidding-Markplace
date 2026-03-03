import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "@carbon/styles/css/styles.css";
import "./styles/global.scss";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import Profile from "./pages/Profile.jsx";
import JobList from "./pages/JobList.jsx";
import NewJob from "./pages/NewJob.jsx";
import JobDetail from "./pages/JobDetail.jsx";
import JobBid from "./pages/JobBid.jsx";
import BidDetail from "./pages/BidDetail.jsx";
import MyBids from "./pages/MyBids.jsx";
import ProtectedApp from "./components/ProtectedApp.jsx";
import LoginFinish from "./pages/LoginFinish";
import Messenger from "./pages/Messenger";
import AdminRoute from "./components/AdminRoute";
import NonAdminRoute from "./components/NonAdminRoute";
import AdminDashboard from "./pages/AdminDashboard";
import UserReviews from "./pages/UserReviews.jsx";
import UserPortfolio from "./pages/UserPortfolio.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        {/* Public Routes*/}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Authenticated Routes*/}
        <Route element={<ProtectedApp />}>
          <Route path="/login/finish" element={<LoginFinish />} />

          {/* Bidder/Poster Routes*/}
          <Route element={<NonAdminRoute />}>
            <Route index element={<Navigate to="/jobs" replace />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/messages" element={<Messenger />} />
            <Route path="/messages/:conversationId" element={<Messenger />} />
            <Route path="/jobs" element={<JobList />} />
            <Route path="/jobs/:jobId" element={<JobDetail />} />
            <Route path="/jobs/:jobId/bid" element={<JobBid />} />
            <Route path="/bids/:jobId" element={<BidDetail />} />
            <Route path="/jobs/myBids" element={<MyBids />} />
            <Route
              path="/jobs/myBids/bidDetails/:jobId"
              element={<BidDetail />}
            />
            <Route path="/new-job" element={<NewJob />} />
            <Route path="/users/:uid/reviews" element={<UserReviews />} />
            <Route path="/users/:uid/portfolio" element={<UserPortfolio />} />
          </Route>

          {/* Admin Routes*/}
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
