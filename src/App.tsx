import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { RefreshProvider } from './contexts/RefreshContext';
import Login from './components/Login';
import Layout from './components/Layout';
import EnquiryIndent from './pages/EnquiryEntry';
import ChallanReceipt from './pages/ChallanReceipt';
import Quotation from './pages/Quotation';
import FollowUp from './pages/FollowUp';
import RepairStatus from './pages/RepairStatus';
import PaymentStatus from './pages/PaymentStatus';
import InvoiceGeneration from './pages/InvoiceGeneration';
import Handover from './pages/Handover';
import Feedback from './pages/Feedback';
import Dashboard from './pages/Dashboard';

function AppContent() {
  const { isAuthenticated } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');

  if (!isAuthenticated) {
    return <Login />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'enquiry':
        return <EnquiryIndent />;
      case 'challan':
        return <ChallanReceipt />;
      case 'quotation':
        return <Quotation />;
      case 'followup':
        return <FollowUp />;
      case 'repairstatus':
        return <RepairStatus />;
      case 'paymentstatus':
        return <PaymentStatus />;
      case 'InvoiceGeneration':
        return <InvoiceGeneration />;
      case 'handover':
        return <Handover />;
      case 'feedback':
        return <Feedback />;
      default:
        return <div className="text-2xl font-bold text-gray-800">Page Not Found</div>;
    }
  };

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
      {renderPage()}
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <RefreshProvider>
        <AppContent />
      </RefreshProvider>
    </AuthProvider>
  );
}

export default App;
