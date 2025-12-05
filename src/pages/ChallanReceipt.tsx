import { useState, useEffect } from 'react';
import { X, Search, Download } from 'lucide-react';

import { Enquiry } from '../types';
import { storage } from '../utils/storage';

export default function ChallanReceipt() {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [formData, setFormData] = useState<{
    machineReceived: 'Yes' | 'No' | '';
    challanFile: string;
  }>({
    machineReceived: '',
    challanFile: '',
  });

  useEffect(() => {
    const allEnquiries = storage.getEnquiries();
    const serviceEnquiries = allEnquiries.filter(
      (e) => e.enquiryType === 'Service' || e.enquiryType === 'Both'
    );
    setEnquiries(serviceEnquiries);
  }, [showModal]); // Refresh when modal closes (after save)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, challanFile: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnquiry) return;

    if (formData.machineReceived === 'Yes' && !formData.challanFile) {
      alert('Please upload challan');
      return;
    }

    storage.updateEnquiry(selectedEnquiry.id, {
      machineReceived: formData.machineReceived as 'Yes' | 'No',
      challanFile: formData.challanFile,
    });

    setShowModal(false);
    setSelectedEnquiry(null);
    setFormData({ machineReceived: '', challanFile: '' });
  };

  const openModal = (enquiry: Enquiry) => {
    setSelectedEnquiry(enquiry);
    // Pre-fill if editing (though usually for pending it's empty)
    setFormData({
      machineReceived: enquiry.machineReceived || '',
      challanFile: enquiry.challanFile || '',
    });
    setShowModal(true);
  };

  const pendingEnquiries = enquiries.filter((e) => !e.machineReceived);
  const historyEnquiries = enquiries.filter((e) => e.machineReceived);

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
      
      // Date filter usually applies to Created Date or Warranty Date. 
      // Prompt says "Date filter", I'll check against createdAt for now or Warranty Last Date.
      // Let's use createdAt date part.
      const createdDate = e.createdAt.split('T')[0];
      const matchesDate = dateFilter === '' || createdDate === dateFilter;

      return matchesSearch && matchesCompany && matchesDate;
    });
  };

  const filteredPending = filterEnquiries(pendingEnquiries);
  const filteredHistory = filterEnquiries(historyEnquiries);

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6">Challan Receipt</h1>

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
              No {activeTab} enquiries found.
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
                        className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors text-xs"
                      >
                        Process
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                    <div>
                      <span className="text-xs text-gray-400 block">Contact</span>
                      {enquiry.contactPersonName}
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block">Phone</span>
                      {enquiry.contactPersonNumber}
                    </div>
                    <div className="col-span-2">
                       <span className="text-xs text-gray-400 block">Address</span>
                       <span className="truncate block">{enquiry.hoBillAddress}</span>
                    </div>
                    {activeTab === 'pending' && (
                      <>
                        <div>
                           <span className="text-xs text-gray-400 block">Priority</span>
                           <span className={`px-2 py-0.5 rounded-full text-xs font-medium w-fit ${
                              enquiry.priority === 'Hot' ? 'bg-red-100 text-red-700' :
                              enquiry.priority === 'Warm' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-blue-100 text-blue-700'
                           }`}>
                             {enquiry.priority}
                           </span>
                        </div>
                        <div>
                           <span className="text-xs text-gray-400 block">Location</span>
                           {enquiry.location}
                        </div>
                      </>
                    )}
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

                  <div className="flex flex-wrap gap-2 text-xs">
                    {enquiry.billAttach && (
                      <a href={enquiry.billAttach} download="bill" className="text-blue-600 flex items-center gap-1 hover:underline">
                        <Download size={14} /> Bill
                      </a>
                    )}
                    {activeTab === 'history' && (
                       <>
                         <span className={`px-2 py-1 rounded-full font-medium ${
                           enquiry.machineReceived === 'Yes' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                         }`}>
                           Received: {enquiry.machineReceived}
                         </span>
                         {enquiry.challanFile && (
                           <a href={enquiry.challanFile} download="challan" className="text-blue-600 flex items-center gap-1 hover:underline">
                             <Download size={14} /> Challan
                           </a>
                         )}
                       </>
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
                {activeTab === 'history' && <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Machine Received</th>}
                {activeTab === 'history' && <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Upload Challan</th>}
                <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Bill Attach</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Items</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Receiver Name</th>
                {activeTab === 'pending' && (
                  <>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Location</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">GST Number</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Email</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Priority</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Warranty</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Warranty Date</th>
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
                  
                  {activeTab === 'history' && (
                    <>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          enquiry.machineReceived === 'Yes' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {enquiry.machineReceived}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {enquiry.challanFile ? (
                          <a href={enquiry.challanFile} download="challan" className="text-blue-600 hover:underline flex items-center gap-1">
                            <Download size={14} /> View
                          </a>
                        ) : '-'}
                      </td>
                    </>
                  )}

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
                          {item.itemName} ({item.modelName}) - Qty: {item.qty}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">{enquiry.receiverName}</td>

                  {activeTab === 'pending' && (
                    <>
                      <td className="px-4 py-3">{enquiry.location}</td>
                      <td className="px-4 py-3">{enquiry.gstNumber}</td>
                      <td className="px-4 py-3">{enquiry.clientEmailId}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          enquiry.priority === 'Hot' ? 'bg-red-100 text-red-700' :
                          enquiry.priority === 'Warm' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {enquiry.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">{enquiry.warrantyCheck}</td>
                      <td className="px-4 py-3">{enquiry.warrantyLastDate || '-'}</td>
                    </>
                  )}
                </tr>
              ))}
              {(activeTab === 'pending' ? filteredPending : filteredHistory).length === 0 && (
                <tr>
                  <td colSpan={activeTab === 'pending' ? 18 : 14} className="px-4 py-8 text-center text-gray-500">
                    No {activeTab} enquiries found.
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
              <h2 className="text-xl font-bold">Process Challan</h2>
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
                    <span className="font-medium text-gray-700">Contact Number:</span>
                    <p className="text-gray-900">{selectedEnquiry.contactPersonNumber}</p>
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
                    Machine Received <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.machineReceived}
                    onChange={(e) => setFormData({ ...formData, machineReceived: e.target.value as 'Yes' | 'No' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>

                {formData.machineReceived === 'Yes' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Upload Challan <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="file"
                      onChange={handleFileUpload}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      accept="image/*,.pdf"
                      required
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setSelectedEnquiry(null);
                    setFormData({ machineReceived: '', challanFile: '' });
                  }}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Save Challan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
