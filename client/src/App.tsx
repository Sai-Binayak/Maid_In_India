import React from "react";
import { Route, Routes } from "react-router-dom";
import { Guard } from "./layouts";
import Landing from "./pages/Landing";
import { Login, Register } from "./pages/Login";
import Discover from "./pages/client/Discover";
import ClientDashboard from "./pages/client/Dashboard";
import MaidDashboard from "./pages/maid/Dashboard";
import AdminDashboard from "./pages/admin/Dashboard";

export default function App() {
  return <Routes>
    <Route path="/" element={<Landing />} />
    <Route path="/find" element={<Discover />} />
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />
    <Route path="/client" element={<Guard role="CLIENT"><ClientDashboard /></Guard>} />
    <Route path="/maid" element={<Guard role="MAID"><MaidDashboard /></Guard>} />
    <Route path="/admin" element={<Guard role="ADMIN"><AdminDashboard /></Guard>} />
  </Routes>;
}
