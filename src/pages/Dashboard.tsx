import { useEffect, useState } from 'react';
import {
  FileText,
  Receipt,
  TrendingUp,
  Users,
  Wrench,
  Truck,
  CheckCircle,
  AlertCircle,
  Briefcase,
  CreditCard,
  ClipboardList,
  Activity,
  Package
} from 'lucide-react';
import { storage } from '../utils/storage';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    // Overview
    totalEnquiries: 0,
    hotPriority: 0,
    activeRepairs: 0,
    pendingPayments: 0,

    // Service
    pendingChallans: 0,
    machinesUnderRepair: 0,
    readyForHandover: 0,
    feedbackPending: 0,

    // Commercial
    pendingQuotations: 0,
    pendingPO: 0, // Order not received yet
    InvoiceGenerationPending: 0, // Invoice not posted
    completedSales: 0
  });

  useEffect(() => {
    const enquiries = storage.getEnquiries();

    // Filter helpers
    const serviceEnquiries = enquiries.filter(e => e.enquiryType === 'Service' || e.enquiryType === 'Both');
    // const salesEnquiries = enquiries.filter(e => e.enquiryType === 'Sales' || e.enquiryType === 'Both');

    // Calculations
    const totalEnquiries = enquiries.length;
    const hotPriority = enquiries.filter(e => e.priority === 'Hot').length;

    // Active Repairs: Machines received but not yet marked repair complete
    const activeRepairs = serviceEnquiries.filter(e =>
      e.machineReceived === 'Yes' && e.machineRepairStatus !== 'Complete'
    ).length;

    // Pending Payments: Payment not complete
    // For Service: repair complete but payment pending
    // For Sales: just payment pending (assuming sales implies immediate payment need)
    const pendingPayments = enquiries.filter(e =>
      e.currentPaymentStatus !== 'Complete'
    ).length;

    // Service Metrics
    const pendingChallans = serviceEnquiries.filter(e => !e.machineReceived || e.machineReceived === 'No').length;
    const machinesUnderRepair = activeRepairs; // Same definition
    const readyForHandover = serviceEnquiries.filter(e =>
      e.machineRepairStatus === 'Complete' && e.currentPaymentStatus === 'Complete' && e.handoverStatus !== 'Complete'
    ).length;
    const feedbackPending = serviceEnquiries.filter(e =>
      e.handoverStatus === 'Complete' && e.feedbackStatus !== 'Complete'
    ).length;

    // Commercial Metrics
    const pendingQuotations = enquiries.filter(e => !e.quotationNumber).length;
    const pendingPO = enquiries.filter(e =>
      e.quotationNumber && e.followUpStatus !== 'Order Received'
    ).length;
    const InvoiceGenerationPending = enquiries.filter(e =>
      (e.followUpStatus === 'Order Received' || e.machineRepairStatus === 'Complete') &&
      !e.serviceInvoiceNo && !e.spareInvoiceNo
    ).length;
    const completedSales = enquiries.filter(e =>
      e.currentPaymentStatus === 'Complete' && (e.enquiryType === 'Sales' || e.enquiryType === 'Both')
    ).length;

    setStats({
      totalEnquiries,
      hotPriority,
      activeRepairs,
      pendingPayments,
      pendingChallans,
      machinesUnderRepair,
      readyForHandover,
      feedbackPending,
      pendingQuotations,
      pendingPO,
      InvoiceGenerationPending,
      completedSales
    });
  }, []);

  const renderCard = (title: string, value: number, Icon: any, color: string, subtext?: string) => (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-all transform hover:-translate-y-1">
      <div className="flex items-center justify-between mb-4">
        <div className={`${color} p-3 rounded-lg`}>
          <Icon className="text-white" size={24} />
        </div>
        <span className="text-3xl font-bold text-gray-800">{value}</span>
      </div>
      <div>
        <h3 className="text-gray-600 font-medium">{title}</h3>
        {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">System Dashboard</h1>

        {/* Tab Navigation */}
        <div className="bg-white p-1 rounded-lg shadow-sm border border-gray-200 inline-flex">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'overview' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('service')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'service' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
          >
            Service Operations
          </button>
          <button
            onClick={() => setActiveTab('commercial')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'commercial' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
          >
            Commercial
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {renderCard('Total Enquiries', stats.totalEnquiries, Users, 'bg-blue-500', 'All active enquiries included')}
              {renderCard('Active Repairs', stats.activeRepairs, Activity, 'bg-purple-500', 'Machines currently in workshop')}
              {renderCard('Pending Payments', stats.pendingPayments, AlertCircle, 'bg-red-500', 'Requires immediate attention')}
              {renderCard('Hot Leads', stats.hotPriority, TrendingUp, 'bg-orange-500', 'High priority enquiries')}
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Briefcase size={20} className="text-blue-600" />
                Quick Actions
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors text-center">
                  <span className="text-blue-600 font-medium">New Enquiry</span>
                </div>
                <div className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors text-center">
                  <span className="text-blue-600 font-medium">Upload Challan</span>
                </div>
                <div className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors text-center">
                  <span className="text-blue-600 font-medium">Generate Quote</span>
                </div>
                <div className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors text-center">
                  <span className="text-blue-600 font-medium">Record Payment</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'service' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in duration-300">
            {renderCard('Pending Receipt', stats.pendingChallans, Truck, 'bg-yellow-500', 'Challan not yet uploaded')}
            {renderCard('Under Repair', stats.machinesUnderRepair, Wrench, 'bg-blue-600', 'In progress repairs')}
            {renderCard('Ready for Handover', stats.readyForHandover, CheckCircle, 'bg-emerald-500', 'Payment & Repair Complete')}
            {renderCard('Feedback Due', stats.feedbackPending, ClipboardList, 'bg-pink-500', 'Handover complete, no feedback')}
          </div>
        )}

        {activeTab === 'commercial' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in duration-300">
            {renderCard('Pending Quotes', stats.pendingQuotations, FileText, 'bg-indigo-500', 'Enquiries without quotation')}
            {renderCard('Awaiting PO', stats.pendingPO, Receipt, 'bg-cyan-500', 'Quote sent, order pending')}
            {renderCard('InvoiceGeneration Pending', stats.InvoiceGenerationPending, CreditCard, 'bg-orange-600', 'Invoice not posted in InvoiceGeneration')}
            {renderCard('Closed Sales', stats.completedSales, Package, 'bg-teal-500', 'Successfully completed sales')}
          </div>
        )}
      </div>

      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="text-blue-600 mt-0.5" size={20} />
          <div>
            <h3 className="text-sm font-medium text-blue-800">System Status</h3>
            <p className="text-sm text-blue-600 mt-1">
              All systems are running smoothly. Last data sync was performed just now.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
