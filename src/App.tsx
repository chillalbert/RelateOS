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
import Notifications from './pages/Notifications';

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { firebaseUser, isLoading } = useAuth();
  if (isLoading) return null;
  return firebaseUser ? <>{children}</> : <Navigate to="/login" />;
};

const ThemeHandler = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();

  React.useEffect(() => {
    if (user?.appearance === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [user?.appearance]);

  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <ThemeHandler>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/add" element={<PrivateRoute><AddPerson /></PrivateRoute>} />
            <Route path="/people" element={<PrivateRoute><People /></PrivateRoute>} />
            <Route path="/person/:id" element={<PrivateRoute><PersonProfile /></PrivateRoute>} />
            <Route path="/analytics" element={<PrivateRoute><Analytics /></PrivateRoute>} />
            <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
            <Route path="/notifications" element={<PrivateRoute><Notifications /></PrivateRoute>} />
            <Route path="/groups/create" element={<PrivateRoute><GroupPlanning /></PrivateRoute>} />
            <Route path="/groups/:id" element={<PrivateRoute><GroupPlanning /></PrivateRoute>} />
            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
      </ThemeHandler>
    </AuthProvider>
  );
}
