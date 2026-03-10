import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { RefreshProvider } from './contexts/RefreshContext';
import Login from './components/Login';
import Layout from './components/Layout';
import EnquiryIndent from './pages/EnquiryEntry';
import ChallanReceipt from './pages/ChallanReceipt';
import MakeQuotation from './pages/Quotation/MakeQuotation';
import FollowUp from './pages/FollowUp';
import RepairStatus from './pages/RepairStatus';
import PaymentStatus from './pages/PaymentStatus';
import InvoiceGeneration from './pages/InvoiceGeneration';
import Handover from './pages/Handover';
import Feedback from './pages/Feedback';
import Dashboard from './pages/Dashboard';

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/enquiry" element={<EnquiryIndent />} />
        <Route path="/challan" element={<ChallanReceipt />} />
        <Route path="/quotation" element={<MakeQuotation />} />
        <Route path="/followup" element={<FollowUp />} />
        <Route path="/repairstatus" element={<RepairStatus />} />
        <Route path="/invoicegeneration" element={<InvoiceGeneration />} />
        <Route path="/handover" element={<Handover />} />
        <Route path="/paymentstatus" element={<PaymentStatus />} />
        <Route path="/feedback" element={<Feedback />} />
        <Route path="*" element={<div className="text-2xl font-bold text-gray-800">Page Not Found</div>} />
      </Routes>
    </Layout>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RefreshProvider>
          <AppRoutes />
        </RefreshProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
