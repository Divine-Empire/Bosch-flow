import { useState, useEffect } from 'react';
import { X, Search, Download } from 'lucide-react';
import { Enquiry } from '../types';
import { storage } from '../utils/storage';

export default function Tally() {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [formData, setFormData] = useState<{
    invoicePlanDate: string;
    invoicePostedBy: string;
    spareInvoiceNo: string;
    spareInvoiceFile: string;
    serviceInvoiceNo: string;
    serviceInvoiceFile: string;
  }>({
    invoicePlanDate: '',
    invoicePostedBy: '',
    spareInvoiceNo: '',
    spareInvoiceFile: '',
    serviceInvoiceNo: '',
    serviceInvoiceFile: '',
  });

  useEffect(() => {
    setEnquiries(storage.getEnquiries());
  }, [showModal]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'spareInvoiceFile' | 'serviceInvoiceFile') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, [field]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnquiry) return;

    storage.updateEnquiry(selectedEnquiry.id, {
      invoicePlanDate: formData.invoicePlanDate,
      invoicePostedBy: formData.invoicePostedBy,
      spareInvoiceNo: formData.spareInvoiceNo,
      spareInvoiceFile: formData.spareInvoiceFile,
      serviceInvoiceNo: formData.serviceInvoiceNo,
      serviceInvoiceFile: formData.serviceInvoiceFile,
    });

    setShowModal(false);
    setSelectedEnquiry(null);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      invoicePlanDate: '',
      invoicePostedBy: '',
      spareInvoiceNo: '',
      spareInvoiceFile: '',
      serviceInvoiceNo: '',
      serviceInvoiceFile: '',
    });
  };

  const openModal = (enquiry: Enquiry) => {
    setSelectedEnquiry(enquiry);
    setFormData({
      invoicePlanDate: enquiry.invoicePlanDate || '',
      invoicePostedBy: enquiry.invoicePostedBy || '',
      spareInvoiceNo: enquiry.spareInvoiceNo || '',
      spareInvoiceFile: enquiry.spareInvoiceFile || '',
      serviceInvoiceNo: enquiry.serviceInvoiceNo || '',
      serviceInvoiceFile: enquiry.serviceInvoiceFile || '',
    });
    setShowModal(true);
  };

  // Pending: Payment Complete AND Tally NOT done (invoicePlanDate empty)
  const pendingEnquiries = enquiries.filter((e) => e.currentPaymentStatus === 'Complete' && !e.invoicePlanDate);
  
  // History: Tally done (invoicePlanDate set)
  const historyEnquiries = enquiries.filter((e) => e.invoicePlanDate);

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
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6">Tally</h1>

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
              No {activeTab} tally records found.
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
                       <div className="flex flex-wrap gap-2 text-xs">
                          <span className="bg-gray-100 px-2 py-1 rounded">Payment: {enquiry.currentPaymentStatus}</span>
                          <span className="bg-gray-100 px-2 py-1 rounded">Repair: {enquiry.machineRepairStatus}</span>
                       </div>
                  </div>
                  
                  {activeTab === 'history' && (
                     <div className="bg-gray-50 p-2 rounded text-sm space-y-1">
                        <div className="flex justify-between">
                           <span className="text-gray-500">Plan Date:</span>
                           <span>{enquiry.invoicePlanDate}</span>
                        </div>
                        <div className="flex justify-between">
                           <span className="text-gray-500">Posted By:</span>
                           <span>{enquiry.invoicePostedBy}</span>
                        </div>
                     </div>
                  )}

                  {activeTab === 'history' && (
                     <div className="flex flex-wrap gap-3 text-xs pt-2 border-t mt-2">
                         {enquiry.spareInvoiceFile && (
                             <a href={enquiry.spareInvoiceFile} download="spare" className="text-blue-600 flex items-center gap-1 hover:underline">
                               <Download size={14} /> Spare Inv ({enquiry.spareInvoiceNo})
                             </a>
                         )}
                         {enquiry.serviceInvoiceFile && (
                             <a href={enquiry.serviceInvoiceFile} download="service" className="text-blue-600 flex items-center gap-1 hover:underline">
                               <Download size={14} /> Service Inv ({enquiry.serviceInvoiceNo})
                             </a>
                         )}
                     </div>
                  )}
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
                <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Quotation No</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Payment Term</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Senior Approval</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Senior Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Machine Repair</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Payment Status</th>

                {activeTab === 'history' && (
                  <>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Plan Date</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Posted By</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Spare Inv No</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Spare Inv</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Service Inv No</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Service Inv</th>
                  </>
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
                  <td className="px-4 py-3">{enquiry.quotationNumber}</td>
                  <td className="px-4 py-3">{enquiry.paymentTerm || '-'}</td>
                  <td className="px-4 py-3">{enquiry.seniorApproval || '-'}</td>
                  <td className="px-4 py-3">{enquiry.seniorName || '-'}</td>
                  <td className="px-4 py-3">{enquiry.machineRepairStatus}</td>
                  <td className="px-4 py-3">{enquiry.currentPaymentStatus}</td>

                  {activeTab === 'history' && (
                    <>
                      <td className="px-4 py-3">{enquiry.invoicePlanDate}</td>
                      <td className="px-4 py-3">{enquiry.invoicePostedBy}</td>
                      <td className="px-4 py-3">{enquiry.spareInvoiceNo}</td>
                      <td className="px-4 py-3">
                        {enquiry.spareInvoiceFile ? (
                          <a href={enquiry.spareInvoiceFile} download="spare-invoice" className="text-blue-600 hover:underline flex items-center gap-1">
                            <Download size={14} /> View
                          </a>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3">{enquiry.serviceInvoiceNo}</td>
                      <td className="px-4 py-3">
                        {enquiry.serviceInvoiceFile ? (
                          <a href={enquiry.serviceInvoiceFile} download="service-invoice" className="text-blue-600 hover:underline flex items-center gap-1">
                            <Download size={14} /> View
                          </a>
                        ) : '-'}
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {(activeTab === 'pending' ? filteredPending : filteredHistory).length === 0 && (
                <tr>
                  <td colSpan={activeTab === 'pending' ? 12 : 17} className="px-4 py-8 text-center text-gray-500">
                    No {activeTab} tally records found.
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
              <h2 className="text-xl font-bold">Process Tally</h2>
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
                    <span className="font-medium text-gray-700">Payment Status:</span>
                    <p className="text-gray-900">{selectedEnquiry.currentPaymentStatus}</p>
                  </div>
                </div>
              </div>

              <div className="border-t pt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    INVOICE PLAN DATE <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.invoicePlanDate}
                    onChange={(e) => setFormData({ ...formData, invoicePlanDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Invoice Posted By <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.invoicePostedBy}
                    onChange={(e) => setFormData({ ...formData, invoicePostedBy: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      SPARE INVOICE No.
                    </label>
                    <input
                      type="text"
                      value={formData.spareInvoiceNo}
                      onChange={(e) => setFormData({ ...formData, spareInvoiceNo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      SPARE INVOICE (File)
                    </label>
                    <input
                      type="file"
                      onChange={(e) => handleFileUpload(e, 'spareInvoiceFile')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      accept="image/*,.pdf"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Service invoice No.
                    </label>
                    <input
                      type="text"
                      value={formData.serviceInvoiceNo}
                      onChange={(e) => setFormData({ ...formData, serviceInvoiceNo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Service invoice (File)
                    </label>
                    <input
                      type="file"
                      onChange={(e) => handleFileUpload(e, 'serviceInvoiceFile')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      accept="image/*,.pdf"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setSelectedEnquiry(null);
                    resetForm();
                  }}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Save Tally
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
