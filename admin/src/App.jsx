import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import PrivateRoute from './PrivateRoute';
import Layout from './Layout';
import Login from './Login';
import Dashboard from './pages/Dashboard';
import Aprovacoes from './pages/Aprovacoes';
import Usuarios from './pages/Usuarios';
import Convites from './pages/Convites';
import Moderacao from './pages/Moderacao';
import Alcance from './pages/Alcance';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="aprovacoes" element={<Aprovacoes />} />
            <Route path="usuarios" element={<Usuarios />} />
            <Route path="convites" element={<Convites />} />
            <Route path="moderacao" element={<Moderacao />} />
            <Route path="alcance" element={<Alcance />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
