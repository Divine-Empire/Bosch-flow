import { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Search, Download, Loader2 } from 'lucide-react';
import { Enquiry, Item } from '../types';
import { fetchSheet, insertRow } from '../utils/api';

const SHEET_NAME = 'Indent';
const REPAIR_SHEET_NAME = 'Repair-Status';
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
  // Challan
  PLANNED_1: 20,
  ACTUAL_1: 21,
  DELAY_1: 22,
  MACHINE_RECEIVED: 23,
  UPLOAD_CHALLAN: 24,
  REMARKS_1: 25,
  // Quotation
  PLANNED_2: 26,
  ACTUAL_2: 27,
  DELAY_2: 28,
  SHARE_QUESTIONS: 29,
  QUOTATION_NUMBER: 30,
  VALUE_BASIC: 31,
  QUOTATION_FILE: 32,
  QUOTATION_REMARKS: 33,
  // Follow Up
  PLANNED_3: 34,
  ACTUAL_3: 35,
  DELAY_3: 36,
  FOLLOW_UP_STATUS: 37,
  NEXT_DATE: 38,
  WHAT_DID_CUSTOMER_SAY: 39,
  PAYMENT_TERM: 40,
  ADVANCE_VALUE: 41,
  PAYMENT_ATTACHMENT: 42,
  SENIOR_APPROVAL: 43,
  SENIOR_NAME: 44,
  // Repair Status Lookups
  PLANNED_4: 45, // AT
  ACTUAL_4: 46,  // AU
  DELAY_4: 47,   // AV
  MACHINE_REPAIR_STATUS: 48, // AW
  REPAIR_REMARKS: 49, // AX
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

    // Quotation (Read-only)
    quotationNumber: row[COL.QUOTATION_NUMBER] || '',
    valueBasic: row[COL.VALUE_BASIC] || '',
    gstAmount: row[80] || '', // COL.GST_AMOUNT

    // Follow Up (Read-only)
    paymentTerm: (row[COL.PAYMENT_TERM] as Enquiry['paymentTerm']) || undefined,
    seniorApproval: (row[COL.SENIOR_APPROVAL] as Enquiry['seniorApproval']) || undefined,
    seniorName: row[COL.SENIOR_NAME] || '',
    paymentAttachment: row[COL.PAYMENT_ATTACHMENT] || '',

    // Repair Status
    planned4: row[COL.PLANNED_4] ? String(row[COL.PLANNED_4]).trim() : '',
    actual4: row[COL.ACTUAL_4] ? String(row[COL.ACTUAL_4]).trim() : '',
    delay4: row[COL.DELAY_4] ? String(row[COL.DELAY_4]).trim() : '',
    machineRepairStatus: (row[COL.MACHINE_REPAIR_STATUS] as Enquiry['machineRepairStatus']) || undefined,
    repairRemarks: row[COL.REPAIR_REMARKS] || '',

    rowIndex,
  };
}

/** Extract YYYY-MM-DD from any timestamp string (ISO or space-separated) */
function formatDate(value: string | undefined): string {
  if (!value) return '-';
  return value.substring(0, 10);
}

/**
 * Convert a Google Sheets duration value to a readable hours string.
 * Sheets serializes durations (e.g. from a formula like =B2-A2) as a
 * date-time anchored at its 1899-12-29 UTC epoch. We subtract that
 * base to get total elapsed time, handling durations > 24h correctly.
 */
function formatDelay(value: string | undefined): string {
  if (!value) return '0 hrs';
  if (value.includes('T') || value.startsWith('1899') || value.startsWith('1900')) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      // Sheets duration epoch observed at 1899-12-29T00:00:00Z
      const BASE_MS = Date.UTC(1899, 11, 29); // Dec 29, 1899 00:00 UTC
      const totalMs = d.getTime() - BASE_MS;
      if (totalMs >= 0) {
        const totalMinutes = Math.floor(totalMs / 60000);
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        return m > 0 ? `${h}h ${m}m` : `${h} hrs`;
      }
    }
  }
  // Plain numeric fallback
  const num = parseFloat(value);
  if (!isNaN(num)) return `${num} hrs`;
  return value;
}

export default function RepairStatus() {
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
    machineRepairStatus: 'Complete' | 'Pending' | '';
    repairRemarks: string;
  }>({
    machineRepairStatus: '',
    repairRemarks: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [indentRows, repairRows] = await Promise.all([
        fetchSheet(SHEET_NAME),
        fetchSheet(REPAIR_SHEET_NAME),
      ]);

      const headerIndex = indentRows.findIndex(
        (row: any[]) => String(row[COL.INDENT_NUMBER]).trim().toLowerCase() === 'indent number'
      );
      const startIndex = headerIndex >= 0 ? headerIndex + 1 : DATA_START_INDEX;

      // Optimize data ingestion by parsing row headers only once, filtering valid strings, and
      // dropping entirely invalid rows.
      const parsed = indentRows
        .slice(startIndex)
        .filter(row => {
          const indentId = String(row[COL.INDENT_NUMBER] || '').trim();
          if (!indentId || !indentId.startsWith('IN-')) return false;

          const planned4 = String(row[COL.PLANNED_4] || '').trim();

          return planned4.length > 0; // Filtered only if Planned exists (pending or history)
        })
        .map((row, index) => rowToEnquiry(row, startIndex + index + 1));

      // Determine next serial number from Repair-Status sheet (Col B is index 1)
      let maxSn = 0;
      for (let i = repairRows.length - 1; i >= 0; i--) {
        const row = repairRows[i];
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

      // Calculate new Delay locally for UI (Sheets formula handles database side)
      let delay4 = '';
      if (selectedEnquiry.planned4) {
        const plannedDate = new Date(selectedEnquiry.planned4);
        if (!isNaN(plannedDate.getTime())) {
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const pDate = new Date(plannedDate.getFullYear(), plannedDate.getMonth(), plannedDate.getDate());
          const diffTime = today.getTime() - pDate.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          delay4 = diffDays > 0 ? diffDays.toString() : '0';
        }
      }

      // Structure exactly matches Repair-Status Sheet columns:
      // A: Timestamp, B: Serial No, C: Indent Number, D: Machine Repair, E: Remarks
      const newData = [
        timestampNoTz,
        nextSerialNo,
        selectedEnquiry.id,
        formData.machineRepairStatus,
        formData.repairRemarks
      ];

      await insertRow(REPAIR_SHEET_NAME, newData);

      // Increment local state SN
      const currentNum = parseInt(nextSerialNo.replace('SN-', ''), 10);
      setNextSerialNo(`SN-${String(currentNum + 1).padStart(3, '0')}`);

      // Optimistically update
      setEnquiries((prev) =>
        prev.map((enq) =>
          enq.id === selectedEnquiry.id
            ? {
              ...enq,
              actual4: timestampNoTz,
              delay4,
              machineRepairStatus: formData.machineRepairStatus as 'Complete' | 'Pending',
              repairRemarks: formData.repairRemarks,
            }
            : enq
        )
      );

      setShowModal(false);
      setSelectedEnquiry(null);
      setFormData({ machineRepairStatus: '', repairRemarks: '' });

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update repair status');
    } finally {
      setSubmitting(false);
    }
  }, [selectedEnquiry, nextSerialNo, formData]);

  const openModal = useCallback((enquiry: Enquiry) => {
    setSelectedEnquiry(enquiry);
    setFormData({
      machineRepairStatus: enquiry.machineRepairStatus || '',
      repairRemarks: enquiry.repairRemarks || '',
    });
    setShowModal(true);
  }, []);

  // Pending: planned4 exists AND actual4 is empty
  const pendingEnquiries = useMemo(() => {
    return enquiries.filter((e) => e.planned4 && e.planned4.length > 0 && (!e.actual4 || e.actual4.length === 0));
  }, [enquiries]);

  // History: planned4 and actual4 both exist
  const historyEnquiries = useMemo(() => {
    return enquiries.filter((e) => e.planned4 && e.planned4.length > 0 && e.actual4 && e.actual4.length > 0);
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
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6">Repair Status</h1>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 flex justify-between items-center shadow-sm">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X size={20} />
          </button>
        </div>
      )}

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

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-gray-500">
          <Loader2 size={22} className="animate-spin" />
          <span>Loading repair statuses...</span>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Mobile View - Cards */}
          <div className="md:hidden">
            {(activeTab === 'pending' ? filteredPending : filteredHistory).length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No {activeTab} repair status found.
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

                    {activeTab === 'history' && (
                      <div className="bg-gray-50 p-3 rounded text-sm space-y-2 border border-gray-100">
                        <div className="grid grid-cols-3 gap-2 mb-2 pb-2 border-b border-gray-200">
                          <div>
                            <span className="text-gray-500 text-xs block uppercase">Planned</span>
                            <span className="font-medium text-gray-900">{formatDate(enquiry.planned4)}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs block uppercase">Actual</span>
                            <span className="font-medium text-gray-900">{formatDate(enquiry.actual4)}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs block uppercase">Delay</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium inline-block mt-0.5 ${parseInt(enquiry.delay4 || '0') > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                              }`}>
                              {formatDelay(enquiry.delay4)}
                            </span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 font-medium">Repair Status</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${enquiry.machineRepairStatus === 'Complete' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                            {enquiry.machineRepairStatus || '-'}
                          </span>
                        </div>
                        {enquiry.repairRemarks && (
                          <div className="text-gray-600 italic border-l-2 border-gray-300 pl-2 mt-2">
                            "{enquiry.repairRemarks}"
                          </div>
                        )}
                      </div>
                    )}

                    {enquiry.paymentAttachment && (
                      <div className="pt-2 border-t mt-2">
                        <a href={enquiry.paymentAttachment} download="payment" className="text-blue-600 text-xs flex items-center gap-1 hover:underline">
                          <Download size={14} /> Payment Attachment
                        </a>
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
                  <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">HO Bill Address</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Quotation No</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Payment Term</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Senior Approval</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Senior Name</th>

                  {activeTab === 'pending' && (
                    <>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Basic Value</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">GST</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Status</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Customer Said</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Advance</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Attachment</th>
                    </>
                  )}

                  {activeTab === 'history' && (
                    <>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Planned Date</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Actual Date</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Delay Time</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Machine Repair</th>
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

                    {activeTab === 'pending' && (
                      <>
                        <td className="px-4 py-3">{enquiry.valueBasic}</td>
                        <td className="px-4 py-3">{enquiry.gstAmount}</td>
                        <td className="px-4 py-3">{enquiry.followUpStatus}</td>
                        <td className="px-4 py-3 max-w-xs truncate" title={enquiry.whatDidCustomerSay}>{enquiry.whatDidCustomerSay || '-'}</td>
                        <td className="px-4 py-3">{enquiry.advanceValue || '-'}</td>
                        <td className="px-4 py-3">
                          {enquiry.paymentAttachment ? (
                            <a href={enquiry.paymentAttachment} download="payment" className="text-blue-600 hover:underline flex items-center gap-1">
                              <Download size={14} /> View
                            </a>
                          ) : '-'}
                        </td>
                      </>
                    )}

                    {activeTab === 'history' && (
                      <>
                        <td className="px-4 py-3 whitespace-nowrap">{formatDate(enquiry.planned4)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{formatDate(enquiry.actual4)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${parseFloat(enquiry.delay4 || '0') > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                            }`}>
                            {formatDelay(enquiry.delay4)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${enquiry.machineRepairStatus === 'Complete' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                            {enquiry.machineRepairStatus || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 max-w-xs truncate" title={enquiry.repairRemarks}>{enquiry.repairRemarks || '-'}</td>
                      </>
                    )}
                  </tr>
                ))}
                {(activeTab === 'pending' ? filteredPending : filteredHistory).length === 0 && (
                  <tr>
                    <td colSpan={activeTab === 'pending' ? 16 : 13} className="px-4 py-8 text-center text-gray-500">
                      No {activeTab} repair status found.
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
              <h2 className="text-xl font-bold">Update Repair Status</h2>
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
                    <span className="font-medium text-gray-700">Payment Term:</span>
                    <p className="text-gray-900">{selectedEnquiry.paymentTerm}</p>
                  </div>
                </div>
              </div>

              <div className="border-t pt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Machine Repair <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.machineRepairStatus}
                    onChange={(e) => setFormData({ ...formData, machineRepairStatus: e.target.value as 'Complete' | 'Pending' })}
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
                    Remarks
                  </label>
                  <textarea
                    value={formData.repairRemarks}
                    onChange={(e) => setFormData({ ...formData, repairRemarks: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setSelectedEnquiry(null);
                    setFormData({ machineRepairStatus: '', repairRemarks: '' });
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
