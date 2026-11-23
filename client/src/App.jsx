import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth, homeFor } from './auth.jsx';
import { Spinner } from './components/ui.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import DashboardLayout from './pages/dashboard/DashboardLayout.jsx';
import Overview from './pages/dashboard/Overview.jsx';
import Orders from './pages/dashboard/Orders.jsx';
import MenuManager from './pages/dashboard/MenuManager.jsx';
import TablesQR from './pages/dashboard/TablesQR.jsx';
import Staff from './pages/dashboard/Staff.jsx';
import Settings from './pages/dashboard/Settings.jsx';
import Admin from './pages/dashboard/Admin.jsx';
import Reception from './pages/dashboard/Reception.jsx';
import WorkerHistory from './pages/dashboard/WorkerHistory.jsx';
import CustomerPage from './pages/customer/CustomerPage.jsx';

function Only({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/r/:slug" element={<CustomerPage />} />

      <Route
        path="/app"
        element={
          <Only>
            <DashboardLayout />
          </Only>
        }
      >
        <Route index element={<Only roles={['owner']}><Overview /></Only>} />
        <Route path="reception" element={<Only roles={['owner', 'receptionist']}><Reception /></Only>} />
        <Route path="orders" element={<Only roles={['owner', 'chef', 'waiter', 'receptionist']}><Orders /></Only>} />
        <Route path="history" element={<Only roles={['owner', 'receptionist']}><WorkerHistory /></Only>} />
        <Route path="menu" element={<Only roles={['owner', 'chef']}><MenuManager /></Only>} />
        <Route path="tables" element={<Only roles={['owner']}><TablesQR /></Only>} />
        <Route path="staff" element={<Only roles={['owner']}><Staff /></Only>} />
        <Route path="settings" element={<Only roles={['owner', 'receptionist']}><Settings /></Only>} />
        <Route path="admin" element={<Only roles={['superadmin']}><Admin /></Only>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
