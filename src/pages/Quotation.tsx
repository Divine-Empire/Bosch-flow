import { useState, useEffect } from 'react';
import { X, Search, Download } from 'lucide-react';
import { Enquiry } from '../types';
import { storage } from '../utils/storage';

export default function Quotation() {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [formData, setFormData] = useState<{
    shareQuestions: 'Yes' | 'No' | '';
    quotationNumber: string;
    valueBasicWithGst: string;
    quotationFile: string;
  }>({
    shareQuestions: '',
    quotationNumber: '',
    valueBasicWithGst: '',
    quotationFile: '',
  });

  useEffect(() => {
    setEnquiries(storage.getEnquiries());
  }, [showModal]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, quotationFile: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnquiry) return;

    storage.updateEnquiry(selectedEnquiry.id, {
      shareQuestions: formData.shareQuestions as 'Yes' | 'No',
      quotationNumber: formData.quotationNumber,
      valueBasicWithGst: formData.valueBasicWithGst,
      quotationFile: formData.quotationFile,
    });

    setShowModal(false);
    setSelectedEnquiry(null);
    setFormData({ shareQuestions: '', quotationNumber: '', valueBasicWithGst: '', quotationFile: '' });
  };

  const openModal = (enquiry: Enquiry) => {
    setSelectedEnquiry(enquiry);
    setFormData({
      shareQuestions: enquiry.shareQuestions || '',
      quotationNumber: enquiry.quotationNumber || '',
      valueBasicWithGst: enquiry.valueBasicWithGst || '',
      quotationFile: enquiry.quotationFile || '',
    });
    setShowModal(true);
  };

  // Pending: Machine Received (Challan done) AND Quotation NOT done (shareQuestions empty)
  const pendingEnquiries = enquiries.filter((e) => e.machineReceived && !e.shareQuestions);
  // History: Quotation done (shareQuestions set)
  const historyEnquiries = enquiries.filter((e) => e.shareQuestions);

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
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6">Quotation</h1>

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
              No {activeTab} quotations found.
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

                  <div className="text-sm text-gray-600 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-xs text-gray-400 block uppercase">Contact Person</span>
                        {enquiry.contactPersonName}
                      </div>
                      <div>
                        <span className="text-xs text-gray-400 block uppercase">Contact Number</span>
                        {enquiry.contactPersonNumber}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block uppercase">Address</span>
                      <span className="block truncate">{enquiry.hoBillAddress}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block uppercase">Status</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium inline-block mt-1 ${
                        enquiry.machineReceived === 'Yes' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                         Machine Received: {enquiry.machineReceived}
                      </span>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded p-2">
                    <p className="text-xs font-medium text-gray-500 mb-1">
                      Items ({enquiry.items.length})
                    </p>
                    <div className="space-y-1">
                      {enquiry.items.slice(0, 2).map((item, i) => (
                        <div key={i} className="text-xs text-gray-700 flex justify-between">
                          <span>{item.itemName}</span>
                          <span className="font-medium">Qty: {item.qty}</span>
                        </div>
                      ))}
                      {enquiry.items.length > 2 && (
                        <p className="text-xs text-gray-400 pt-1">
                          +{enquiry.items.length - 2} more items
                        </p>
                      )}
                    </div>
                  </div>

                  {activeTab === 'history' && (
                    <div className="bg-blue-50 rounded p-2 text-sm space-y-1 border border-blue-100">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Quotation #:</span>
                        <span className="font-medium text-blue-900">{enquiry.quotationNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Value (GST):</span>
                        <span className="font-medium text-blue-900">{enquiry.valueBasicWithGst}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Share Questions:</span>
                        <span className="font-medium text-blue-900">{enquiry.shareQuestions}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3 text-xs pt-2 border-t">
                    {enquiry.challanFile && (
                      <a href={enquiry.challanFile} download="challan" className="text-blue-600 flex items-center gap-1 hover:underline">
                        <Download size={14} /> Challan
                      </a>
                    )}
                    {enquiry.billAttach && (
                      <a href={enquiry.billAttach} download="bill" className="text-blue-600 flex items-center gap-1 hover:underline">
                        <Download size={14} /> Bill
                      </a>
                    )}
                    {enquiry.quotationFile && (
                      <a href={enquiry.quotationFile} download="quotation" className="text-blue-600 flex items-center gap-1 hover:underline">
                        <Download size={14} /> Quotation
                      </a>
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
                <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Machine Received</th>
                
                {activeTab === 'pending' && (
                  <>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Upload Challan</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Bill Attach</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Items</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Receiver Name</th>
                  </>
                )}

                {activeTab === 'history' && (
                  <>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Share Questions</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Quotation Number</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Value (GST)</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">File</th>
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
                  <td className="px-4 py-3 max-w-xs truncate" title={enquiry.hoBillAddress}>{enquiry.hoBillAddress}</td>
                  <td className="px-4 py-3">{enquiry.machineReceived}</td>

                  {activeTab === 'pending' && (
                    <>
                      <td className="px-4 py-3">
                        {enquiry.challanFile ? (
                          <a href={enquiry.challanFile} download="challan" className="text-blue-600 hover:underline flex items-center gap-1">
                            <Download size={14} /> View
                          </a>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {enquiry.billAttach ? (
                          <a href={enquiry.billAttach} download="bill" className="text-blue-600 hover:underline flex items-center gap-1">
                            <Download size={14} /> View
                          </a>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="max-h-20 overflow-y-auto">
                          {enquiry.items.map((item, i) => (
                            <div key={i} className="text-xs border-b last:border-0 py-1">
                              {item.itemName} ({item.qty})
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">{enquiry.receiverName}</td>
                    </>
                  )}

                  {activeTab === 'history' && (
                    <>
                      <td className="px-4 py-3">{enquiry.shareQuestions}</td>
                      <td className="px-4 py-3">{enquiry.quotationNumber}</td>
                      <td className="px-4 py-3">{enquiry.valueBasicWithGst}</td>
                      <td className="px-4 py-3">
                        {enquiry.quotationFile ? (
                          <a href={enquiry.quotationFile} download="quotation" className="text-blue-600 hover:underline flex items-center gap-1">
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
                  <td colSpan={activeTab === 'pending' ? 12 : 11} className="px-4 py-8 text-center text-gray-500">
                    No {activeTab} quotations found.
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
              <h2 className="text-xl font-bold">Process Quotation</h2>
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
                    <span className="font-medium text-gray-700">Client Type:</span>
                    <p className="text-gray-900">{selectedEnquiry.clientType}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Company Name:</span>
                    <p className="text-gray-900">{selectedEnquiry.companyName}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Contact Person:</span>
                    <p className="text-gray-900">{selectedEnquiry.contactPersonName}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Machine Received:</span>
                    <p className="text-gray-900">{selectedEnquiry.machineReceived}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">HO Bill Address:</span>
                    <p className="text-gray-900">{selectedEnquiry.hoBillAddress}</p>
                  </div>
                </div>
              </div>

              <div className="border-t pt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Share Questions <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.shareQuestions}
                    onChange={(e) => setFormData({ ...formData, shareQuestions: e.target.value as 'Yes' | 'No' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quotation Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.quotationNumber}
                    onChange={(e) => setFormData({ ...formData, quotationNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Value basic with GST <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.valueBasicWithGst}
                    onChange={(e) => setFormData({ ...formData, valueBasicWithGst: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    File (Upload Image) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    accept="image/*"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setSelectedEnquiry(null);
                    setFormData({ shareQuestions: '', quotationNumber: '', valueBasicWithGst: '', quotationFile: '' });
                  }}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Save Quotation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
