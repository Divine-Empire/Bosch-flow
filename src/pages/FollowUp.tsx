import { useState, useEffect } from 'react';
import { X, Search, Download } from 'lucide-react';
import { Enquiry } from '../types';
import { storage } from '../utils/storage';

export default function FollowUp() {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [formData, setFormData] = useState<{
    followUpStatus: 'Flw-Up' | 'Order Received' | '';
    whatDidCustomerSay: string;
    paymentTerm: 'Advance' | 'Credit' | '';
    advanceValue: string;
    paymentAttachment: string;
    seniorApproval: 'Yes' | 'No' | '';
    seniorName: string;
  }>({
    followUpStatus: '',
    whatDidCustomerSay: '',
    paymentTerm: '',
    advanceValue: '',
    paymentAttachment: '',
    seniorApproval: '',
    seniorName: '',
  });

  useEffect(() => {
    setEnquiries(storage.getEnquiries());
  }, [showModal]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, paymentAttachment: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnquiry) return;

    storage.updateEnquiry(selectedEnquiry.id, {
      followUpStatus: formData.followUpStatus as 'Flw-Up' | 'Order Received',
      whatDidCustomerSay: formData.whatDidCustomerSay,
      paymentTerm: formData.paymentTerm as 'Advance' | 'Credit',
      advanceValue: formData.advanceValue,
      paymentAttachment: formData.paymentAttachment,
      seniorApproval: formData.seniorApproval as 'Yes' | 'No',
      seniorName: formData.seniorName,
    });

    setShowModal(false);
    setSelectedEnquiry(null);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      followUpStatus: '',
      whatDidCustomerSay: '',
      paymentTerm: '',
      advanceValue: '',
      paymentAttachment: '',
      seniorApproval: '',
      seniorName: '',
    });
  };

  const openModal = (enquiry: Enquiry) => {
    setSelectedEnquiry(enquiry);
    setFormData({
      followUpStatus: enquiry.followUpStatus || '',
      whatDidCustomerSay: enquiry.whatDidCustomerSay || '',
      paymentTerm: enquiry.paymentTerm || '',
      advanceValue: enquiry.advanceValue || '',
      paymentAttachment: enquiry.paymentAttachment || '',
      seniorApproval: enquiry.seniorApproval || '',
      seniorName: enquiry.seniorName || '',
    });
    setShowModal(true);
  };

  // Pending: Quotation done AND (Status is undefined OR Status is 'Flw-Up')
  // Actually, if status is 'Order Received', it moves to next stage, so it shouldn't be pending here?
  // Or maybe it stays in history here.
  const pendingEnquiries = enquiries.filter((e) => e.shareQuestions && e.followUpStatus !== 'Order Received');
  
  // History: Status is set
  const historyEnquiries = enquiries.filter((e) => e.followUpStatus);

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
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6">Follow Up</h1>

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
              No {activeTab} follow-ups found.
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
                    <p><span className="text-gray-400 text-xs uppercase mr-1">Contact:</span> {enquiry.contactPersonName} ({enquiry.contactPersonNumber})</p>
                    <p><span className="text-gray-400 text-xs uppercase mr-1">Address:</span> {enquiry.hoBillAddress}</p>
                    <div className="flex gap-4">
                      <p><span className="text-gray-400 text-xs uppercase mr-1">Quot #:</span> {enquiry.quotationNumber}</p>
                      <p><span className="text-gray-400 text-xs uppercase mr-1">Value:</span> {enquiry.valueBasicWithGst}</p>
                    </div>
                  </div>

                  {activeTab === 'history' && (
                    <div className="bg-gray-50 p-3 rounded space-y-2 text-sm border border-gray-100">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 font-medium">Status</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          enquiry.followUpStatus === 'Order Received' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {enquiry.followUpStatus}
                        </span>
                      </div>
                      
                      {enquiry.followUpStatus === 'Flw-Up' && (
                        <div className="text-gray-600 italic border-l-2 border-gray-300 pl-2">
                          "{enquiry.whatDidCustomerSay}"
                        </div>
                      )}

                      {enquiry.followUpStatus === 'Order Received' && (
                        <div className="space-y-1 pt-1 border-t border-gray-200 mt-1">
                          <p><span className="text-gray-500">Payment:</span> {enquiry.paymentTerm}</p>
                          {enquiry.paymentTerm === 'Advance' && (
                            <p><span className="text-gray-500">Advance:</span> {enquiry.advanceValue}</p>
                          )}
                          {enquiry.paymentTerm === 'Credit' && (
                            <p><span className="text-gray-500">Senior:</span> {enquiry.seniorName} ({enquiry.seniorApproval})</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3 text-xs pt-2 border-t">
                    {enquiry.quotationFile && (
                      <a href={enquiry.quotationFile} download="quotation" className="text-blue-600 flex items-center gap-1 hover:underline">
                        <Download size={14} /> Quotation
                      </a>
                    )}
                    {enquiry.paymentAttachment && (
                      <a href={enquiry.paymentAttachment} download="payment" className="text-blue-600 flex items-center gap-1 hover:underline">
                        <Download size={14} /> Payment
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
                <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Quotation No</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Value (GST)</th>
                
                {activeTab === 'pending' && (
                  <>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Machine Received</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Share Questions</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">File</th>
                  </>
                )}

                {activeTab === 'history' && (
                  <>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Customer Said</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Payment Term</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Advance</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Attachment</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Senior Approval</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Senior Name</th>
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
                  <td className="px-4 py-3">{enquiry.quotationNumber}</td>
                  <td className="px-4 py-3">{enquiry.valueBasicWithGst}</td>

                  {activeTab === 'pending' && (
                    <>
                      <td className="px-4 py-3">{enquiry.machineReceived}</td>
                      <td className="px-4 py-3">{enquiry.shareQuestions}</td>
                      <td className="px-4 py-3">
                        {enquiry.quotationFile ? (
                          <a href={enquiry.quotationFile} download="quotation" className="text-blue-600 hover:underline flex items-center gap-1">
                            <Download size={14} /> View
                          </a>
                        ) : '-'}
                      </td>
                    </>
                  )}

                  {activeTab === 'history' && (
                    <>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          enquiry.followUpStatus === 'Order Received' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {enquiry.followUpStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate" title={enquiry.whatDidCustomerSay}>{enquiry.whatDidCustomerSay || '-'}</td>
                      <td className="px-4 py-3">{enquiry.paymentTerm || '-'}</td>
                      <td className="px-4 py-3">{enquiry.advanceValue || '-'}</td>
                      <td className="px-4 py-3">
                        {enquiry.paymentAttachment ? (
                          <a href={enquiry.paymentAttachment} download="payment" className="text-blue-600 hover:underline flex items-center gap-1">
                            <Download size={14} /> View
                          </a>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3">{enquiry.seniorApproval || '-'}</td>
                      <td className="px-4 py-3">{enquiry.seniorName || '-'}</td>
                    </>
                  )}
                </tr>
              ))}
              {(activeTab === 'pending' ? filteredPending : filteredHistory).length === 0 && (
                <tr>
                  <td colSpan={activeTab === 'pending' ? 12 : 15} className="px-4 py-8 text-center text-gray-500">
                    No {activeTab} follow-ups found.
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
              <h2 className="text-xl font-bold">Process Follow Up</h2>
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
                    <span className="font-medium text-gray-700">Contact Person:</span>
                    <p className="text-gray-900">{selectedEnquiry.contactPersonName}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Quotation Number:</span>
                    <p className="text-gray-900">{selectedEnquiry.quotationNumber}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Value (GST):</span>
                    <p className="text-gray-900">{selectedEnquiry.valueBasicWithGst}</p>
                  </div>
                </div>
              </div>

              <div className="border-t pt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.followUpStatus}
                    onChange={(e) => setFormData({ ...formData, followUpStatus: e.target.value as 'Flw-Up' | 'Order Received' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select</option>
                    <option value="Flw-Up">Flw-Up</option>
                    <option value="Order Received">Order Received</option>
                  </select>
                </div>

                {formData.followUpStatus === 'Flw-Up' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      What Did Customer Say <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={formData.whatDidCustomerSay}
                      onChange={(e) => setFormData({ ...formData, whatDidCustomerSay: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      required
                    />
                  </div>
                )}

                {formData.followUpStatus === 'Order Received' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Payment Term <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.paymentTerm}
                        onChange={(e) => setFormData({ ...formData, paymentTerm: e.target.value as 'Advance' | 'Credit' })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="">Select</option>
                        <option value="Advance">Advance</option>
                        <option value="Credit">Credit</option>
                      </select>
                    </div>

                    {formData.paymentTerm === 'Advance' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Advance Value <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={formData.advanceValue}
                            onChange={(e) => setFormData({ ...formData, advanceValue: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Attachment <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="file"
                            onChange={handleFileUpload}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            accept="image/*,.pdf"
                            required
                          />
                        </div>
                      </>
                    )}

                    {formData.paymentTerm === 'Credit' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Senior Approval <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={formData.seniorApproval}
                            onChange={(e) => setFormData({ ...formData, seniorApproval: e.target.value as 'Yes' | 'No' })}
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
                            Senior Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={formData.seniorName}
                            onChange={(e) => setFormData({ ...formData, seniorName: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}
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
                  Save Follow Up
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
