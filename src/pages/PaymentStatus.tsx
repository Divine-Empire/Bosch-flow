import { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Search, Loader2 } from 'lucide-react';
import { Enquiry, Item } from '../types';
import { fetchSheet, insertRow } from '../utils/api';

const SHEET_NAME = 'Indent';
const PAYMENT_SHEET_NAME = 'Payment-Status';
const DATA_START_INDEX = 7;

// Column indices derived from row structure
const COL = {
  TIMESTAMP: 0,
  ENTRY_NO: 1,
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
  // Payment Status mappings
  PLANNED_5: 50, // AY
  ACTUAL_5: 51,  // AZ
  DELAY_5: 52,   // BA
  CURRENT_PAYMENT_STATUS: 53, // BB
  PAYMENT_REMARKS: 54, // BC
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
    id: row[COL.ENTRY_NO],
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
    billDate: row[COL.WARRANTY_LAST_DATE] ? String(row[COL.WARRANTY_LAST_DATE]) : '',
    billAttach: row[COL.BILL_ATTACH] || '',
    items: items.length > 0 ? items : [{ itemName: '', modelName: '', qty: 0, partNo: '' }],
    receiverName: row[COL.RECEIVER_NAME] || '',
    createdAt: row[COL.TIMESTAMP] || new Date().toISOString(),

    // Payment Status ReadOnly Lookups
    quotationNumber: row[30] || '', // COL.QUOTATION_NUMBER
    paymentTerm: (row[40] as Enquiry['paymentTerm']) || undefined, // COL.PAYMENT_TERM
    seniorApproval: (row[43] as Enquiry['seniorApproval']) || undefined, // COL.SENIOR_APPROVAL
    seniorName: row[44] || '', // COL.SENIOR_NAME
    machineRepairStatus: (row[48] as Enquiry['machineRepairStatus']) || undefined, // COL.MACHINE_REPAIR_STATUS
    repairRemarks: row[49] || '', // COL.REPAIR_REMARKS

    // Payment Status Update Fields
    planned5: row[COL.PLANNED_5] ? String(row[COL.PLANNED_5]).trim() : '',
    actual5: row[COL.ACTUAL_5] ? String(row[COL.ACTUAL_5]).trim() : '',
    delay5: row[COL.DELAY_5] ? String(row[COL.DELAY_5]).trim() : '',
    currentPaymentStatus: (row[COL.CURRENT_PAYMENT_STATUS] as Enquiry['currentPaymentStatus']) || undefined,
    paymentRemarks: row[COL.PAYMENT_REMARKS] || '',

    rowIndex,
  };
}

export default function PaymentStatus() {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [nextSerialNo, setNextSerialNo] = useState<string>('SN-001');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [formData, setFormData] = useState<{
    currentPaymentStatus: 'Complete' | 'Pending' | '';
    paymentRemarks: string;
  }>({
    currentPaymentStatus: '',
    paymentRemarks: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [indentRows, paymentRows] = await Promise.all([
        fetchSheet(SHEET_NAME),
        fetchSheet(PAYMENT_SHEET_NAME),
      ]);

      const headerIndex = indentRows.findIndex(
        (row: any[]) => String(row[COL.ENTRY_NO]).trim().toLowerCase() === 'entry no.'
      );
      const startIndex = headerIndex >= 0 ? headerIndex + 1 : DATA_START_INDEX;

      const parsed = indentRows
        .slice(startIndex)
        .filter(row => {
          const entryId = String(row[COL.ENTRY_NO] || '').trim();
          if (!entryId || !entryId.startsWith('IN-')) return false;

          const planned5 = String(row[COL.PLANNED_5] || '').trim();
          return planned5.length > 0;
        })
        .map((row, index) => rowToEnquiry(row, startIndex + index + 1));

      // Determine next serial number from Payment-Status sheet (Col B is index 1)
      let maxSn = 0;
      for (let i = paymentRows.length - 1; i >= 0; i--) {
        const row = paymentRows[i];
        const snStr = String(row[1] || '').trim();
        if (snStr.startsWith('SN-')) {
          const num = parseInt(snStr.replace('SN-', ''), 10);
          if (!isNaN(num) && num > maxSn) {
            maxSn = num;
            break; // Stop after finding the latest valid SN (assuming sequential)
          }
        }
      }
      const nextSn = `SN-${String(maxSn + 1).padStart(3, '0')}`;

      setEnquiries(parsed);
      setNextSerialNo(nextSn);
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
      // YYYY-MM-DD HH:mm:ss
      const pad = (n: number) => String(n).padStart(2, '0');
      const timestampNoTz = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

      let delay5 = '';
      if (selectedEnquiry.planned5) {
        const plannedDate = new Date(selectedEnquiry.planned5);
        if (!isNaN(plannedDate.getTime())) {
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const pDate = new Date(plannedDate.getFullYear(), plannedDate.getMonth(), plannedDate.getDate());
          const diffTime = today.getTime() - pDate.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          delay5 = diffDays > 0 ? diffDays.toString() : '0';
        }
      }

      const newData = [
        timestampNoTz,
        nextSerialNo,
        selectedEnquiry.id,
        formData.currentPaymentStatus,
        formData.paymentRemarks
      ];

      await insertRow(PAYMENT_SHEET_NAME, newData);

      // Increment local state SN
      const currentNum = parseInt(nextSerialNo.replace('SN-', ''), 10);
      setNextSerialNo(`SN-${String(currentNum + 1).padStart(3, '0')}`);

      setEnquiries((prev) =>
        prev.map((enq) =>
          enq.id === selectedEnquiry.id
            ? {
              ...enq,
              actual5: timestampNoTz,
              delay5,
              currentPaymentStatus: formData.currentPaymentStatus as 'Complete' | 'Pending',
              paymentRemarks: formData.paymentRemarks,
            }
            : enq
        )
      );

      setShowModal(false);
      setSelectedEnquiry(null);
      setFormData({ currentPaymentStatus: '', paymentRemarks: '' });

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update payment status');
    } finally {
      setSubmitting(false);
    }
  }, [selectedEnquiry, nextSerialNo, formData]);

  const openModal = useCallback((enquiry: Enquiry) => {
    setSelectedEnquiry(enquiry);
    setFormData({
      currentPaymentStatus: enquiry.currentPaymentStatus || '',
      paymentRemarks: enquiry.paymentRemarks || '',
    });
    setShowModal(true);
  }, []);

  // Pending: planned5 exists AND actual5 is empty
  const pendingEnquiries = useMemo(() => {
    return enquiries.filter((e) => e.planned5 && e.planned5.length > 0 && (!e.actual5 || e.actual5.length === 0));
  }, [enquiries]);

  // History: planned5 and actual5 both exist
  const historyEnquiries = useMemo(() => {
    return enquiries.filter((e) => e.planned5 && e.planned5.length > 0 && e.actual5 && e.actual5.length > 0);
  }, [enquiries]);

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
      const createdDate = e.createdAt?.split('T')[0] || '';
      const matchesDate = dateFilter === '' || createdDate === dateFilter;

      return matchesSearch && matchesCompany && matchesDate;
    });
  }, [searchTerm, dateFilter, companyFilter]);

  const filteredPending = useMemo(() => filterEnquiries(pendingEnquiries), [filterEnquiries, pendingEnquiries]);
  const filteredHistory = useMemo(() => filterEnquiries(historyEnquiries), [filterEnquiries, historyEnquiries]);

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
          <span>Loading payment statuses...</span>
        </div>
      ) : (
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
                      <div className="grid grid-cols-3 gap-2 mb-2 pb-2 border-b border-gray-200">
                        <div>
                          <span className="text-gray-500 text-xs block uppercase">Planned</span>
                          <span className="font-medium text-gray-900">{enquiry.planned5?.split(' ')[0] || '-'}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs block uppercase">Actual</span>
                          <span className="font-medium text-gray-900">{enquiry.actual5?.split(' ')[0] || '-'}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs block uppercase">Delay</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium inline-block mt-0.5 ${parseInt(enquiry.delay5 || '0') > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {enquiry.delay5 || '0'} Days
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-gray-500">Repair Status:</span>
                        <span className="font-medium text-gray-900">{enquiry.machineRepairStatus}</span>
                      </div>

                      {activeTab === 'history' && (
                        <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                          <span className="text-gray-500">Payment Status:</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${enquiry.currentPaymentStatus === 'Complete' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                            {enquiry.currentPaymentStatus}
                          </span>
                        </div>
                      )}

                      {activeTab === 'pending' && enquiry.repairRemarks && (
                        <p className="text-gray-600 italic text-xs pt-2 border-t border-gray-200">
                          Repair Remark: "{enquiry.repairRemarks}"
                        </p>
                      )}

                      {activeTab === 'history' && enquiry.paymentRemarks && (
                        <p className="text-gray-600 italic text-xs pt-2 border-t border-gray-200">
                          Payment Remark: "{enquiry.paymentRemarks}"
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
                  <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Entry No.</th>
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
                    <>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Planned Date</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Actual Date</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Delay Time</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Current Payment Status</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Remarks</th>
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
                    <td className="px-4 py-3">{enquiry.paymentTerm || '-'}</td>
                    <td className="px-4 py-3">{enquiry.seniorApproval || '-'}</td>
                    <td className="px-4 py-3">{enquiry.seniorName || '-'}</td>
                    <td className="px-4 py-3">{enquiry.machineRepairStatus}</td>

                    {activeTab === 'pending' && (
                      <td className="px-4 py-3 max-w-xs truncate" title={enquiry.repairRemarks}>{enquiry.repairRemarks || '-'}</td>
                    )}

                    {activeTab === 'history' && (
                      <>
                        <td className="px-4 py-3 whitespace-nowrap">{enquiry.planned5?.split(' ')[0] || '-'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{enquiry.actual5?.split(' ')[0] || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${parseInt(enquiry.delay5 || '0') > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {enquiry.delay5 || '0'} Days
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${enquiry.currentPaymentStatus === 'Complete' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                            {enquiry.currentPaymentStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 max-w-xs truncate" title={enquiry.paymentRemarks}>{enquiry.paymentRemarks || '-'}</td>
                      </>
                    )}
                  </tr>
                ))}
                {(activeTab === 'pending' ? filteredPending : filteredHistory).length === 0 && (
                  <tr>
                    <td colSpan={activeTab === 'pending' ? 13 : 16} className="px-4 py-8 text-center text-gray-500">
                      No {activeTab} payment status found.
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
                    <span className="font-medium text-gray-700">Entry No.:</span>
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Remarks</label>
                  <textarea
                    value={formData.paymentRemarks}
                    onChange={(e) => setFormData({ ...formData, paymentRemarks: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Enter payment remarks..."
                  ></textarea>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setSelectedEnquiry(null);
                    setFormData({ currentPaymentStatus: '', paymentRemarks: '' });
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
                  {submitting ? 'Saving...' : 'Save Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
