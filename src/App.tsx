import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import AddPerson from './pages/AddPerson';
import PersonProfile from './pages/PersonProfile';
import Analytics from './pages/Analytics';
import GroupPlanning from './pages/GroupPlanning';
import People from './pages/People';
import Settings from './pages/Settings';

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { token, isLoading } = useAuth();
  if (isLoading) return null;
  return token ? <>{children}</> : <Navigate to="/login" />;
};

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/add" element={<PrivateRoute><AddPerson /></PrivateRoute>} />
          <Route path="/people" element={<PrivateRoute><People /></PrivateRoute>} />
          <Route path="/person/:id" element={<PrivateRoute><PersonProfile /></PrivateRoute>} />
          <Route path="/analytics" element={<PrivateRoute><Analytics /></PrivateRoute>} />
          <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
          <Route path="/groups/create" element={<PrivateRoute><GroupPlanning /></PrivateRoute>} />
          <Route path="/groups/:id" element={<PrivateRoute><GroupPlanning /></PrivateRoute>} />
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
