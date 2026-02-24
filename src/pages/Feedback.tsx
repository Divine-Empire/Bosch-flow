import { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Search, Download, Loader2 } from 'lucide-react';
import { Enquiry, Item } from '../types';
import { fetchSheet, updateRow } from '../utils/api';

const SHEET_NAME = 'Indent';
const DATA_START_INDEX = 7;

// Column indices derived from row structure
const COL = {
  TIMESTAMP: 0,
  INDENT_NUMBER: 1,
  ENQUIRY_TYPE: 2,
  CLIENT_TYPE: 3,
  COMPANY_NAME: 4,
  CONTACT_PERSON_NAME: 5,
  CONTACT_PERSON_NUMBER: 6,
  HO_BILL_ADDRESS: 7,
  LOCATION: 8,
  GST_NUMBER: 9,
  CLIENT_EMAIL_ID: 10,
  PRIORITY: 11,
  WARRANTY_CHECK: 12,
  WARRANTY_LAST_DATE: 13,
  BILL_ATTACH: 14,
  ITEMS_NAME: 15,
  MODEL_NAME: 16,
  QTY: 17,
  PART_NO: 18,
  RECEIVER_NAME: 19,
  // Feedback mappings
  PLANNED_8: 75, // BX
  ACTUAL_8: 76,  // BY
  DELAY_8: 77,   // BZ
  FEEDBACK_STATUS: 78, // CA
  FEEDBACK_REMARKS: 79, // CB
};

function parseJsonCell(value: string): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatDate(dateString?: string): string {
  if (!dateString) return '-';
  const d = new Date(dateString);
  if (!isNaN(d.getTime())) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  return dateString.split(' ')[0] || '-';
}

function rowToEnquiry(row: string[], rowIndex: number): Enquiry {
  const itemNames = parseJsonCell(row[COL.ITEMS_NAME]);
  const modelNames = parseJsonCell(row[COL.MODEL_NAME]);
  const qtys = parseJsonCell(row[COL.QTY]);
  const partNos = parseJsonCell(row[COL.PART_NO]);

  const items: Item[] = itemNames.map((name, i) => ({
    itemName: name || '',
    modelName: modelNames[i] || '',
    qty: parseInt(qtys[i]) || 0,
    partNo: partNos[i] || '',
  }));

  return {
    id: row[COL.INDENT_NUMBER],
    enquiryType: (row[COL.ENQUIRY_TYPE] as Enquiry['enquiryType']) || 'Sales',
    clientType: (row[COL.CLIENT_TYPE] as Enquiry['clientType']) || 'New',
    companyName: row[COL.COMPANY_NAME] || '',
    contactPersonName: row[COL.CONTACT_PERSON_NAME] || '',
    contactPersonNumber: String(row[COL.CONTACT_PERSON_NUMBER] || ''),
    hoBillAddress: row[COL.HO_BILL_ADDRESS] || '',
    location: row[COL.LOCATION] || '',
    gstNumber: row[COL.GST_NUMBER] || '',
    clientEmailId: row[COL.CLIENT_EMAIL_ID] || '',
    priority: (row[COL.PRIORITY] as Enquiry['priority']) || 'Hot',
    warrantyCheck: (row[COL.WARRANTY_CHECK] as Enquiry['warrantyCheck']) || 'No',
    warrantyLastDate: row[COL.WARRANTY_LAST_DATE] ? String(row[COL.WARRANTY_LAST_DATE]) : '',
    billAttach: row[COL.BILL_ATTACH] || '',
    items: items.length > 0 ? items : [{ itemName: '', modelName: '', qty: 0, partNo: '' }],
    receiverName: row[COL.RECEIVER_NAME] || '',
    createdAt: row[COL.TIMESTAMP] || new Date().toISOString(),

    // Legacy Fields Needed for UI table logic
    quotationNumber: row[30] || '',
    paymentTerm: (row[40] as Enquiry['paymentTerm']) || undefined,
    seniorApproval: (row[43] as Enquiry['seniorApproval']) || undefined,
    seniorName: row[44] || '',
    machineRepairStatus: (row[48] as Enquiry['machineRepairStatus']) || undefined,
    currentPaymentStatus: (row[53] as Enquiry['currentPaymentStatus']) || undefined,
    invoicePlanDate: row[58] || undefined,
    invoicePostedBy: row[59] || '',
    spareInvoiceNo: row[60] || '',
    spareInvoiceFile: row[61] || '',
    serviceInvoiceNo: row[62] || '',
    serviceInvoiceFile: row[63] || '',
    handoverStatus: (row[68] as Enquiry['handoverStatus']) || undefined,
    handoverBy: row[69] || '',
    handoverDate: row[70] || '',
    handoverTo: row[71] || '',
    handoverToContactNo: row[72] || '',
    handoverChallanFile: row[73] || '',

    // Feedback Fields (BX -> CB)
    planned8: row[COL.PLANNED_8] ? String(row[COL.PLANNED_8]).trim() : '',
    actual8: row[COL.ACTUAL_8] ? String(row[COL.ACTUAL_8]).trim() : '',
    delay8: row[COL.DELAY_8] ? String(row[COL.DELAY_8]).trim() : '',
    feedbackStatus: (row[COL.FEEDBACK_STATUS] as Enquiry['feedbackStatus']) || undefined,
    feedbackRemarks: row[COL.FEEDBACK_REMARKS] || '',

    rowIndex,
  };
}

export default function Feedback() {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [formData, setFormData] = useState<{
    feedbackStatus: 'Complete' | 'Pending' | '';
    feedbackRemarks: string;
  }>({
    feedbackStatus: '',
    feedbackRemarks: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchSheet(SHEET_NAME);

      const headerIndex = rows.findIndex(
        (row: any[]) => String(row[COL.INDENT_NUMBER]).trim().toLowerCase() === 'indent number'
      );
      const startIndex = headerIndex >= 0 ? headerIndex + 1 : DATA_START_INDEX;

      const parsed = rows
        .map((row, index) => rowToEnquiry(row, index + 1)) // +1 because GAS is 1-indexed and JS is 0-indexed
        .slice(startIndex)
        .filter(enq => {
          const indentId = enq.id;
          // Keep only rows mapping to this Feedback phase that actually have a Planned 8 date 
          if (!indentId || !indentId.startsWith('IN-')) return false;

          const planned8 = enq.planned8;
          return (planned8 && planned8.length > 0);
        });

      setEnquiries(parsed);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnquiry || !selectedEnquiry.rowIndex) return;

    setSubmitting(true);
    setError(null);

    try {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const timestampNoTz = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

      const newData: string[] = new Array(85).fill('');

      // Avoid touching Delay (BZ) -> let Google Sheets calculate difference formula
      newData[COL.ACTUAL_8] = timestampNoTz; // BY
      newData[COL.FEEDBACK_STATUS] = formData.feedbackStatus; // CA
      newData[COL.FEEDBACK_REMARKS] = formData.feedbackRemarks; // CB

      await updateRow(SHEET_NAME, selectedEnquiry.rowIndex, newData);

      setEnquiries((prev) =>
        prev.map((enq) =>
          enq.id === selectedEnquiry.id
            ? {
              ...enq,
              actual8: timestampNoTz,
              feedbackStatus: formData.feedbackStatus as 'Complete' | 'Pending',
              feedbackRemarks: formData.feedbackRemarks
            }
            : enq
        )
      );

      setShowModal(false);
      setSelectedEnquiry(null);
      resetForm();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update Feedback');
    } finally {
      setSubmitting(false);
    }
  }, [selectedEnquiry, formData]);

  const resetForm = useCallback(() => {
    setFormData({ feedbackStatus: '', feedbackRemarks: '' });
  }, []);

  const openModal = useCallback((enquiry: Enquiry) => {
    setSelectedEnquiry(enquiry);
    setFormData({
      feedbackStatus: enquiry.feedbackStatus || '',
      feedbackRemarks: enquiry.feedbackRemarks || '',
    });
    setShowModal(true);
  }, []);

  // Pending: Feedback NOT Complete (and possesses a planned date - enforced in loadData)
  const pendingEnquiries = useMemo(() =>
    enquiries.filter((e) => !e.actual8),
    [enquiries]);

  // History: Feedback Complete
  const historyEnquiries = useMemo(() =>
    enquiries.filter((e) => e.actual8),
    [enquiries]);

  const handleTabChange = (tab: 'pending' | 'history') => {
    setActiveTab(tab);
    setSearchTerm('');
    setCompanyFilter('');
    setDateFilter('');
  };

  const companyNames = useMemo(() => {
    const listToUse = activeTab === 'pending' ? pendingEnquiries : historyEnquiries;
    return [...new Set(listToUse.map((e) => e.companyName))].filter(Boolean);
  }, [activeTab, pendingEnquiries, historyEnquiries]);

  const filterEnquiries = useCallback((enquiriesList: Enquiry[]) => {
    const lowerSearch = searchTerm.toLowerCase();
    return enquiriesList.filter((e) => {
      const searchFields = [
        e.id,
        e.companyName,
        e.contactPersonName,
        e.contactPersonNumber,
        e.hoBillAddress,
        e.receiverName,
        e.quotationNumber,
        e.machineReceived,
        e.followUpStatus,
        e.machineRepairStatus,
        e.currentPaymentStatus,
        e.clientType,
        e.paymentTerm
      ];

      const matchesSearch =
        lowerSearch === '' ||
        searchFields.some(val => val && String(val).toLowerCase().includes(lowerSearch));

      const matchesCompany = companyFilter === '' || e.companyName === companyFilter;
      const createdDate = e.createdAt.split('T')[0];
      const matchesDate = dateFilter === '' || createdDate === dateFilter;

      return matchesSearch && matchesCompany && matchesDate;
    });
  }, [searchTerm, companyFilter, dateFilter]);

  const filteredPending = useMemo(() => filterEnquiries(pendingEnquiries), [filterEnquiries, pendingEnquiries]);
  const filteredHistory = useMemo(() => filterEnquiries(historyEnquiries), [filterEnquiries, historyEnquiries]);

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6">Feedback</h1>

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
              {companyNames.map((name) => (
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
            onClick={() => handleTabChange('pending')}
            className={`flex-1 px-6 py-3 font-medium transition-colors ${activeTab === 'pending'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-800'
              }`}
          >
            Pending ({filteredPending.length})
          </button>
          <button
            onClick={() => handleTabChange('history')}
            className={`flex-1 px-6 py-3 font-medium transition-colors ${activeTab === 'history'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-800'
              }`}
          >
            History ({filteredHistory.length})
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 shadow-sm border border-red-100">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-gray-500">
          <Loader2 size={22} className="animate-spin" />
          <span>Loading Feedback logs...</span>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Mobile View - Cards */}
          <div className="md:hidden">
            {(activeTab === 'pending' ? filteredPending : filteredHistory).length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No {activeTab} feedback records found.
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
                        <span className="bg-gray-100 px-2 py-1 rounded">Handover: {enquiry.handoverStatus}</span>
                      </div>
                    </div>

                    <div className="bg-gray-50 p-2 rounded text-sm space-y-1">
                      {activeTab === 'history' ? (
                        <div className="space-y-1">
                          <div className="grid grid-cols-3 gap-2 mb-2 pb-2 border-b border-gray-200">
                            <div>
                              <span className="text-gray-500 text-xs block uppercase">Planned</span>
                              <span className="font-medium text-gray-900">{enquiry.planned8?.split(' ')[0] || '-'}</span>
                            </div>
                            <div>
                              <span className="text-gray-500 text-xs block uppercase">Actual</span>
                              <span className="font-medium text-gray-900">{enquiry.actual8?.split(' ')[0] || '-'}</span>
                            </div>
                            <div>
                              <span className="text-gray-500 text-xs block uppercase">Delay</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium inline-block mt-0.5 ${parseInt(enquiry.delay8 || '0') > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                {enquiry.delay8 || '0'} Days
                              </span>
                            </div>
                          </div>

                          <div className="flex justify-between">
                            <span className="text-gray-500">Feedback:</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${enquiry.feedbackStatus === 'Complete' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                              {enquiry.feedbackStatus}
                            </span>
                          </div>
                          {enquiry.feedbackRemarks && <p className="text-gray-600 italic">"{enquiry.feedbackRemarks}"</p>}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500">
                          Handover by {enquiry.handoverBy} on {formatDate(enquiry.handoverDate)} to {enquiry.handoverTo}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
                  <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Plan Date</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Posted By</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Spare Inv No</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Spare Inv</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Service Inv No</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Service Inv</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Handover Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Handover By</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Handover Date</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Handover To</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Handover To Contact</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Handover Challan</th>

                  {activeTab === 'history' && (
                    <>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Planned Date</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Actual Date</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Delay Time</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Feedback Status</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Feedback Remarks</th>
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
                    <td className="px-4 py-3">{formatDate(enquiry.invoicePlanDate)}</td>
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
                    <td className="px-4 py-3">{enquiry.handoverStatus}</td>
                    <td className="px-4 py-3">{enquiry.handoverBy}</td>
                    <td className="px-4 py-3">{formatDate(enquiry.handoverDate)}</td>
                    <td className="px-4 py-3">{enquiry.handoverTo}</td>
                    <td className="px-4 py-3">{enquiry.handoverToContactNo}</td>
                    <td className="px-4 py-3">
                      {enquiry.handoverChallanFile ? (
                        <a href={enquiry.handoverChallanFile} download="handover-challan" className="text-blue-600 hover:underline flex items-center gap-1">
                          <Download size={14} /> View
                        </a>
                      ) : '-'}
                    </td>

                    {activeTab === 'history' && (
                      <>
                        <td className="px-4 py-3 whitespace-nowrap">{enquiry.planned8?.split(' ')[0] || '-'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{enquiry.actual8?.split(' ')[0] || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${parseInt(enquiry.delay8 || '0') > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {enquiry.delay8 || '0'} Days
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${enquiry.feedbackStatus === 'Complete' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                            {enquiry.feedbackStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 max-w-xs truncate" title={enquiry.feedbackRemarks}>{enquiry.feedbackRemarks || '-'}</td>
                      </>
                    )}
                  </tr>
                ))}
                {(activeTab === 'pending' ? filteredPending : filteredHistory).length === 0 && (
                  <tr>
                    <td colSpan={activeTab === 'pending' ? 24 : 26} className="px-4 py-8 text-center text-gray-500">
                      No {activeTab} feedback records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && selectedEnquiry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="bg-blue-600 text-white px-6 py-4 flex justify-between items-center rounded-t-lg shrink-0">
              <h2 className="text-xl font-bold">Process Feedback</h2>
              <button onClick={() => setShowModal(false)} className="hover:text-gray-200">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col">
              <div className="space-y-4 mb-6 shrink-0">
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
                    <span className="font-medium text-gray-700">Handover Date:</span>
                    <p className="text-gray-900">{formatDate(selectedEnquiry.handoverDate)}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Handover To:</span>
                    <p className="text-gray-900">{selectedEnquiry.handoverTo || '-'}</p>
                  </div>
                </div>
              </div>

              <div className="border-t pt-6 space-y-4 shrink-0">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Feedback Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.feedbackStatus}
                    onChange={(e) => setFormData({ ...formData, feedbackStatus: e.target.value as 'Complete' | 'Pending' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select</option>
                    <option value="Complete">Complete</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Feedback Remarks
                  </label>
                  <textarea
                    value={formData.feedbackRemarks}
                    onChange={(e) => setFormData({ ...formData, feedbackRemarks: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-8 shrink-0 border-t pt-4">
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
                  disabled={submitting}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Feedback'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
