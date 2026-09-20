import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Worklist from "./pages/Worklist";
import RadiologistDashboard from "./pages/RadiologistDashboard";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import StudyViewer from "./pages/StudyViewer";
import ReviewedStudies from "./pages/ReviewedStudies";
import AppLayout from "./components/layout/AppLayout";
import { authService } from "./services/authService";

function RootRoute() {
  const user = authService.getCurrentUser();
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Login />;
}

function AuthRoute({ children }) {
  const user = authService.getCurrentUser();
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Authentication Routes (Split-Screen Hero) */}
        <Route path="/" element={<RootRoute />} />
        <Route path="/login" element={<AuthRoute><Login /></AuthRoute>} />
        <Route path="/register" element={<AuthRoute><Login /></AuthRoute>} />
        <Route path="/signup" element={<AuthRoute><Login /></AuthRoute>} />
        <Route path="/forgot-password" element={<Login />} />
        <Route path="/reset-password" element={<Login />} />

        {/* Authenticated Application Shell */}
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<RadiologistDashboard />} />
          <Route path="/worklist" element={<Worklist />} />
          <Route path="/reviewed" element={<ReviewedStudies />} />
          <Route path="/reviewed-studies" element={<ReviewedStudies />} />
          <Route path="/study/:studyId" element={<StudyViewer />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/profile" element={<Profile />} />
        </Route>

        {/* Catch-all fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;