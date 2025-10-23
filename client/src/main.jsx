import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "@carbon/styles/css/styles.css";
import "./styles/global.scss";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import KycGate from "./pages/KycGate.jsx";
import Profile from "./pages/Profile.jsx";
import JobList from "./pages/JobList.jsx";
import NewJob from "./pages/NewJob.jsx";
import JobDetail from "./pages/JobDetail.jsx";
import JobBid from "./pages/JobBid.jsx";
import BidDetail from "./pages/BidDetail.jsx";
import MyBids from "./pages/MyBids.jsx";
import ProtectedApp from "./components/ProtectedApp.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route element={<ProtectedApp />}>
          <Route index element={<Navigate to="/jobs" replace />} />
          <Route path="/kyc" element={<KycGate />} />
          <Route path="/profile" element={<Profile />} />
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
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
