import { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { Enquiry } from '../types';
import { storage } from '../utils/storage';

export default function PaymentStatus() {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [formData, setFormData] = useState<{
    currentPaymentStatus: 'Complete' | 'Pending' | '';
  }>({
    currentPaymentStatus: '',
  });

  useEffect(() => {
    setEnquiries(storage.getEnquiries());
  }, [showModal]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnquiry) return;

    storage.updateEnquiry(selectedEnquiry.id, {
      currentPaymentStatus: formData.currentPaymentStatus as 'Complete' | 'Pending',
    });

    setShowModal(false);
    setSelectedEnquiry(null);
    setFormData({ currentPaymentStatus: '' });
  };

  const openModal = (enquiry: Enquiry) => {
    setSelectedEnquiry(enquiry);
    setFormData({
      currentPaymentStatus: enquiry.currentPaymentStatus || '',
    });
    setShowModal(true);
  };

  // Pending: Machine Repair Complete AND Payment Status NOT Complete
  const pendingEnquiries = enquiries.filter((e) => e.machineRepairStatus === 'Complete' && e.currentPaymentStatus !== 'Complete');
  
  // History: Payment Status IS Complete
  const historyEnquiries = enquiries.filter((e) => e.currentPaymentStatus === 'Complete');

  const getCompanyNames = () => {
    return [...new Set(enquiries.map((e) => e.companyName))];
  };

  const filterEnquiries = (enquiriesList: Enquiry[]) => {
    return enquiriesList.filter((e) => {
      const matchesSearch =
        searchTerm === '' ||
        e.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.contactPersonName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCompany = companyFilter === '' || e.companyName === companyFilter;
      const createdDate = e.createdAt.split('T')[0];
      const matchesDate = dateFilter === '' || createdDate === dateFilter;

      return matchesSearch && matchesCompany && matchesDate;
    });
  };

  const filteredPending = filterEnquiries(pendingEnquiries);
  const filteredHistory = filterEnquiries(historyEnquiries);

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6">Payment Status</h1>

      <div className="bg-white rounded-lg shadow-md mb-6 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Companies</option>
              {getCompanyNames().map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date Filter</label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchTerm('');
                setDateFilter('');
                setCompanyFilter('');
              }}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md mb-4">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 px-6 py-3 font-medium transition-colors ${
              activeTab === 'pending'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Pending ({filteredPending.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 px-6 py-3 font-medium transition-colors ${
              activeTab === 'history'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            History ({filteredHistory.length})
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {/* Mobile View - Cards */}
        <div className="md:hidden">
          {(activeTab === 'pending' ? filteredPending : filteredHistory).length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No {activeTab} payment status found.
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {(activeTab === 'pending' ? filteredPending : filteredHistory).map((enquiry) => (
                <div key={enquiry.id} className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                        {enquiry.id}
                      </span>
                      <h3 className="font-medium text-gray-900 mt-1">{enquiry.companyName}</h3>
                      <p className="text-xs text-gray-500">{enquiry.clientType}</p>
                    </div>
                    {activeTab === 'pending' && (
                      <button
                        onClick={() => openModal(enquiry)}
                        className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors text-sm"
                      >
                        Process
                      </button>
                    )}
                  </div>

                  <div className="text-sm text-gray-600 space-y-1">
                    <p><span className="text-xs text-gray-400 uppercase mr-1">Contact:</span> {enquiry.contactPersonName} ({enquiry.contactPersonNumber})</p>
                    <p><span className="text-xs text-gray-400 uppercase mr-1">Quote #:</span> {enquiry.quotationNumber}</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                        <span className="bg-gray-100 px-2 py-1 rounded">Pay: {enquiry.paymentTerm || '-'}</span>
                        {enquiry.seniorApproval && <span className="bg-gray-100 px-2 py-1 rounded">Senior: {enquiry.seniorName} ({enquiry.seniorApproval})</span>}
                    </div>
                  </div>

                  <div className="bg-gray-50 p-2 rounded text-sm space-y-2 border border-gray-100">
                     <div className="flex justify-between">
                        <span className="text-gray-500">Repair Status:</span>
                        <span className="font-medium text-gray-900">{enquiry.machineRepairStatus}</span>
                     </div>
                     
                     {activeTab === 'history' && (
                        <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                            <span className="text-gray-500">Payment Status:</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                               enquiry.currentPaymentStatus === 'Complete' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                               {enquiry.currentPaymentStatus}
                            </span>
                        </div>
                     )}

                     {activeTab === 'pending' && enquiry.repairRemarks && (
                       <p className="text-gray-600 italic text-xs pt-2 border-t border-gray-200">
                         Remark: "{enquiry.repairRemarks}"
                       </p>
                     )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Desktop View - Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead className="bg-gray-50">
              <tr>
                {activeTab === 'pending' && <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Action</th>}
                <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Indent Number</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Client Type</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Company Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Contact Person</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Contact Number</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">HO Bill Address</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Quotation No</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Payment Term</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Senior Approval</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Senior Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Machine Repair</th>

                {activeTab === 'pending' && (
                  <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Remarks</th>
                )}

                {activeTab === 'history' && (
                  <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Current Payment Status</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(activeTab === 'pending' ? filteredPending : filteredHistory).map((enquiry) => (
                <tr key={enquiry.id} className="hover:bg-gray-50">
                  {activeTab === 'pending' && (
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openModal(enquiry)}
                        className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors text-sm"
                      >
                        Process
                      </button>
                    </td>
                  )}
                  <td className="px-4 py-3 font-medium text-blue-600">{enquiry.id}</td>
                  <td className="px-4 py-3">{enquiry.clientType}</td>
                  <td className="px-4 py-3">{enquiry.companyName}</td>
                  <td className="px-4 py-3">{enquiry.contactPersonName}</td>
                  <td className="px-4 py-3">{enquiry.contactPersonNumber}</td>
                  <td className="px-4 py-3 max-w-xs truncate" title={enquiry.hoBillAddress}>{enquiry.hoBillAddress}</td>
                  <td className="px-4 py-3">{enquiry.quotationNumber}</td>
                  <td className="px-4 py-3">{enquiry.paymentTerm || '-'}</td>
                  <td className="px-4 py-3">{enquiry.seniorApproval || '-'}</td>
                  <td className="px-4 py-3">{enquiry.seniorName || '-'}</td>
                  <td className="px-4 py-3">{enquiry.machineRepairStatus}</td>

                  {activeTab === 'pending' && (
                    <td className="px-4 py-3 max-w-xs truncate" title={enquiry.repairRemarks}>{enquiry.repairRemarks || '-'}</td>
                  )}

                  {activeTab === 'history' && (
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        enquiry.currentPaymentStatus === 'Complete' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {enquiry.currentPaymentStatus}
                      </span>
                    </td>
                  )}
                </tr>
              ))}
              {(activeTab === 'pending' ? filteredPending : filteredHistory).length === 0 && (
                <tr>
                  <td colSpan={activeTab === 'pending' ? 13 : 12} className="px-4 py-8 text-center text-gray-500">
                    No {activeTab} payment status found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && selectedEnquiry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl">
            <div className="bg-blue-600 text-white px-6 py-4 flex justify-between items-center rounded-t-lg">
              <h2 className="text-xl font-bold">Update Payment Status</h2>
              <button onClick={() => setShowModal(false)} className="hover:text-gray-200">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4 mb-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Indent Number:</span>
                    <p className="text-gray-900">{selectedEnquiry.id}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Company Name:</span>
                    <p className="text-gray-900">{selectedEnquiry.companyName}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Quotation Number:</span>
                    <p className="text-gray-900">{selectedEnquiry.quotationNumber}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Advance Payment:</span>
                    <p className="text-gray-900">{selectedEnquiry.advanceValue || 'N/A'}</p>
                  </div>
                </div>
              </div>

              <div className="border-t pt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Current Payment Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.currentPaymentStatus}
                    onChange={(e) => setFormData({ ...formData, currentPaymentStatus: e.target.value as 'Complete' | 'Pending' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select</option>
                    <option value="Complete">Complete</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setSelectedEnquiry(null);
                    setFormData({ currentPaymentStatus: '' });
                  }}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Save Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
