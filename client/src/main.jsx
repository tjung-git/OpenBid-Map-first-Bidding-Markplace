import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "@carbon/styles/css/styles.css";
import "./styles/global.scss";
import App from "./App.jsx";
import Login from "./pages/Login.jsx";
import KycGate from "./pages/KycGate.jsx";
import JobList from "./pages/JobList.jsx";
import NewJob from "./pages/NewJob.jsx";
import JobDetail from "./pages/JobDetail.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<App />}>
          <Route index element={<Navigate to="/jobs" replace />} />
          <Route path="/kyc" element={<KycGate />} />
          <Route path="/jobs" element={<JobList />} />
          <Route path="/jobs/:jobId" element={<JobDetail />} />
          <Route path="/new-job" element={<NewJob />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
