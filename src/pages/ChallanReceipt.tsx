import { useState, useEffect, useCallback } from 'react';
import { X, Search, Download, Loader2 } from 'lucide-react';

import { Enquiry, Item } from '../types';
import { fetchSheet, updateRow, uploadFileToDrive, formatTimestamp } from '../utils/api';

const SHEET_NAME = 'Indent';
const DATA_START_INDEX = 7;

// Column indices (0-based)
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
  // Challan receipt columns
  PLANNED_1: 20,
  ACTUAL_1: 21,
  DELAY_1: 22,
  MACHINE_RECEIVED: 23,
  UPLOAD_CHALLAN: 24,
  REMARKS_1: 25,
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function parseJsonCell(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Map a raw sheet row (string[]) into an Enquiry object. */
function rowToEnquiry(row: string[], rowIndex: number): Enquiry {
  const itemNames = parseJsonCell(row[COL.ITEMS_NAME]);
  const modelNames = parseJsonCell(row[COL.MODEL_NAME]);
  const qtys = parseJsonCell(row[COL.QTY]);
  const partNos = parseJsonCell(row[COL.PART_NO]);

  const items: Item[] = itemNames.map((name, i) => ({
    id: String(i + 1),
    itemName: name,
    modelName: modelNames[i] ?? '',
    qty: Number(qtys[i]) || 0,
    partNo: partNos[i] ?? '',
  }));

  return {
    rowIndex, // 1-based index in the sheet
    id: row[COL.INDENT_NUMBER],
    enquiryType: (row[COL.ENQUIRY_TYPE] as Enquiry['enquiryType']) || 'Sales',
    clientType: (row[COL.CLIENT_TYPE] as Enquiry['clientType']) || 'New',
    companyName: row[COL.COMPANY_NAME] ?? '',
    contactPersonName: row[COL.CONTACT_PERSON_NAME] ?? '',
    contactPersonNumber: row[COL.CONTACT_PERSON_NUMBER] ?? '',
    hoBillAddress: row[COL.HO_BILL_ADDRESS] ?? '',
    location: row[COL.LOCATION] ?? '',
    gstNumber: row[COL.GST_NUMBER] ?? '',
    clientEmailId: row[COL.CLIENT_EMAIL_ID] ?? '',
    priority: (row[COL.PRIORITY] as Enquiry['priority']) || 'Hot',
    warrantyCheck: (row[COL.WARRANTY_CHECK] as Enquiry['warrantyCheck']) || 'No',
    warrantyLastDate: row[COL.WARRANTY_LAST_DATE] ? String(row[COL.WARRANTY_LAST_DATE]) : '',
    billAttach: row[COL.BILL_ATTACH] ?? '',
    items: items.length > 0 ? items : [{ id: '1', itemName: '', modelName: '', qty: 0, partNo: '' }],
    receiverName: row[COL.RECEIVER_NAME] ?? '',
    createdAt: row[COL.TIMESTAMP] ?? '',

    planned1: row[COL.PLANNED_1] ? String(row[COL.PLANNED_1]) : '',
    actual1: row[COL.ACTUAL_1] ? String(row[COL.ACTUAL_1]) : '',
    delay1: row[COL.DELAY_1] ?? '',
    machineReceived: (row[COL.MACHINE_RECEIVED] as 'Yes' | 'No') || '',
    challanFile: row[COL.UPLOAD_CHALLAN] ?? '',
    remarks: row[COL.REMARKS_1] ?? '',
  };
}

// ─── Utility: File → base64 string ────────────────────────────────────────────
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function ChallanReceipt() {
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
    machineReceived: 'Yes' | 'No' | '';
    remarks: string;
  }>({
    machineReceived: '',
    remarks: '',
  });
  const [challanFile, setChallanFile] = useState<File | null>(null);

  // ── Load data from GAS sheet ─────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchSheet(SHEET_NAME);

      const headerIndex = rows.findIndex(
        row => String(row[COL.INDENT_NUMBER]).trim().toLowerCase() === 'indent number'
      );
      const startIndex = headerIndex >= 0 ? headerIndex + 1 : DATA_START_INDEX;

      // Extract all rows, mapping their original sheet rowIndex (i + 1)
      const parsed: Enquiry[] = [];
      for (let i = startIndex; i < rows.length; i++) {
        const row = rows[i];
        if (row[COL.INDENT_NUMBER] && String(row[COL.INDENT_NUMBER]).startsWith('IN-')) {
          const enq = rowToEnquiry(row, i + 1);
          enq.rawRow = row; // Attach the original row data back to the entity
          // Only Service or Both fall into Challan Receipt
          if (enq.enquiryType === 'Service' || enq.enquiryType === 'Both') {
            parsed.push(enq);
          }
        }
      }
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setChallanFile(e.target.files?.[0] ?? null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnquiry || !selectedEnquiry.rowIndex) return;

    if (formData.machineReceived === 'Yes' && !challanFile) {
      alert('Please upload challan');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      let challanUrl = '';
      if (challanFile) {
        const base64 = await fileToBase64(challanFile);
        challanUrl = await uploadFileToDrive(base64, challanFile.name, challanFile.type);
      }

      const actualTimestamp = formatTimestamp(new Date());

      // Create an array filled with empty strings.
      // The new formula-safe backend script loops through this array,
      // and if it sees an empty string (''), it skips updating that cell.
      // E.g., Planned 1 (index 20) and Delay 1 (index 22) will remain untouched!
      const rowData = new Array(26).fill('');
      rowData[COL.ACTUAL_1] = actualTimestamp;
      rowData[COL.MACHINE_RECEIVED] = formData.machineReceived;
      rowData[COL.UPLOAD_CHALLAN] = challanUrl;
      rowData[COL.REMARKS_1] = formData.remarks;

      await updateRow(SHEET_NAME, selectedEnquiry.rowIndex, rowData);

      // Optimistically update
      setEnquiries(prev =>
        prev.map(enq =>
          enq.id === selectedEnquiry.id
            ? {
              ...enq,
              actual1: actualTimestamp,
              machineReceived: formData.machineReceived as 'Yes' | 'No',
              challanFile: challanUrl,
              remarks: formData.remarks,
            }
            : enq
        )
      );

      setShowModal(false);
      setSelectedEnquiry(null);
      setFormData({ machineReceived: '', remarks: '' });
      setChallanFile(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save challan');
    } finally {
      setSubmitting(false);
    }
  };

  const openModal = (enquiry: Enquiry) => {
    setSelectedEnquiry(enquiry);
    setFormData({
      machineReceived: enquiry.machineReceived || '',
      remarks: enquiry.remarks || '',
    });
    setChallanFile(null);
    setShowModal(true);
  };

  // ── Filters & Derivations ───────────────────────────────────────────────

  // Pending: planned1 exists AND no actual1
  const pendingEnquiries = enquiries.filter((e) => e.planned1 && !e.actual1);

  // History: actual1 exists
  const historyEnquiries = enquiries.filter((e) => e.actual1);

  const handleTabChange = (tab: 'pending' | 'history') => {
    setActiveTab(tab);
    setSearchTerm('');
    setCompanyFilter('');
    setDateFilter('');
  };

  const getCompanyNames = () => {
    const listToUse = activeTab === 'pending' ? pendingEnquiries : historyEnquiries;
    return [...new Set(listToUse.map((e) => e.companyName))].filter(Boolean);
  };

  const filterEnquiries = (enquiriesList: Enquiry[]) => {
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

      let matchesDate = true;
      if (dateFilter) {
        // Use planned1 for Pending, Actual1 for History
        const dateToCheck = activeTab === 'pending' ? e.planned1 : e.actual1;
        // The date from sheet could be "2026-02-21 11:50:24"
        const datePart = dateToCheck ? dateToCheck.split(' ')[0] : '';
        matchesDate = datePart.startsWith(dateFilter);
      }

      return matchesSearch && matchesCompany && matchesDate;
    });
  };

  const filteredPending = filterEnquiries(pendingEnquiries);
  const filteredHistory = filterEnquiries(historyEnquiries);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6">Challan Receipt</h1>

      {error && !showModal && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Filters */}
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Date Filter (Planned / Actual)</label>
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

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-gray-500">
            <Loader2 size={22} className="animate-spin" />
            <span>Loading enquiries...</span>
          </div>
        ) : (
          <>
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

                        <div>
                          <span className="text-xs text-gray-400 block">
                            {activeTab === 'pending' ? 'Planned 1' : 'Actual 1'}
                          </span>
                          {activeTab === 'pending'
                            ? (enquiry.planned1 ? enquiry.planned1.slice(0, 10) : '-')
                            : (enquiry.actual1 ? enquiry.actual1.slice(0, 10) : '-')}
                        </div>

                        {activeTab === 'pending' && (
                          <>
                            <div>
                              <span className="text-xs text-gray-400 block">Priority</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium w-fit ${enquiry.priority === 'Hot' ? 'bg-red-100 text-red-700' :
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
                          <a href={enquiry.billAttach} target="_blank" rel="noreferrer" className="text-blue-600 flex items-center gap-1 hover:underline">
                            <Download size={14} /> Bill
                          </a>
                        )}
                        {activeTab === 'history' && (
                          <>
                            <span className={`px-2 py-1 rounded-full font-medium ${enquiry.machineReceived === 'Yes' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                              }`}>
                              Received: {enquiry.machineReceived}
                            </span>
                            {enquiry.challanFile && (
                              <a href={enquiry.challanFile} target="_blank" rel="noreferrer" className="text-blue-600 flex items-center gap-1 hover:underline">
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
                    {/* The new Date columns */}
                    {activeTab === 'pending' && <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Planned Date</th>}
                    {activeTab === 'history' && <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Actual Date</th>}

                    <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Client Type</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Company Name</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Contact Person</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Contact Number</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">HO Bill Address</th>

                    {activeTab === 'history' && (
                      <>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Machine Received</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Upload Challan</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Remarks</th>
                      </>
                    )}

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

                      {activeTab === 'pending' && <td className="px-4 py-3 text-gray-600">{enquiry.planned1 ? enquiry.planned1.slice(0, 10) : '-'}</td>}
                      {activeTab === 'history' && <td className="px-4 py-3 text-gray-600">{enquiry.actual1 ? enquiry.actual1.slice(0, 10) : '-'}</td>}

                      <td className="px-4 py-3">{enquiry.clientType}</td>
                      <td className="px-4 py-3">{enquiry.companyName}</td>
                      <td className="px-4 py-3">{enquiry.contactPersonName}</td>
                      <td className="px-4 py-3">{enquiry.contactPersonNumber}</td>
                      <td className="px-4 py-3 max-w-xs truncate" title={enquiry.hoBillAddress}>{enquiry.hoBillAddress}</td>

                      {activeTab === 'history' && (
                        <>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${enquiry.machineReceived === 'Yes' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                              }`}>
                              {enquiry.machineReceived}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {enquiry.challanFile ? (
                              <a href={enquiry.challanFile} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                                <Download size={14} /> View
                              </a>
                            ) : '-'}
                          </td>
                          <td className="px-4 py-3 max-w-xs truncate" title={enquiry.remarks}>{enquiry.remarks || '-'}</td>
                        </>
                      )}

                      <td className="px-4 py-3">
                        {enquiry.billAttach ? (
                          <a href={enquiry.billAttach} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                            <Download size={14} /> View
                          </a>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="max-h-20 overflow-y-auto pr-2 gap-1 flex flex-col">
                          {enquiry.items.map((item, i) => (
                            <div key={i} className="text-xs border-b last:border-0 py-1 whitespace-nowrap">
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
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${enquiry.priority === 'Hot' ? 'bg-red-100 text-red-700' :
                              enquiry.priority === 'Warm' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-blue-100 text-blue-700'
                              }`}>
                              {enquiry.priority}
                            </span>
                          </td>
                          <td className="px-4 py-3">{enquiry.warrantyCheck}</td>
                          <td className="px-4 py-3">{enquiry.warrantyLastDate ? enquiry.warrantyLastDate.slice(0, 10) : '-'}</td>
                        </>
                      )}
                    </tr>
                  ))}
                  {(activeTab === 'pending' ? filteredPending : filteredHistory).length === 0 && (
                    <tr>
                      <td colSpan={19} className="px-4 py-8 text-center text-gray-500">
                        No {activeTab} enquiries found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {showModal && selectedEnquiry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl">
            <div className="bg-blue-600 text-white px-6 py-4 flex justify-between items-center rounded-t-lg">
              <h2 className="text-xl font-bold">Process Challan</h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setSelectedEnquiry(null);
                  setError(null);
                  setFormData({ machineReceived: '', remarks: '' });
                  setChallanFile(null);
                }}
                className="hover:text-gray-200"
                disabled={submitting}
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                  {error}
                </div>
              )}

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
                    {challanFile && <p className="text-xs text-gray-500 mt-1">Selected: {challanFile.name}</p>}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Remarks
                  </label>
                  <textarea
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Add any remarks..."
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setShowModal(false);
                    setSelectedEnquiry(null);
                    setError(null);
                    setFormData({ machineReceived: '', remarks: '' });
                    setChallanFile(null);
                  }}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 size={16} className="animate-spin" />}
                  {submitting ? 'Saving...' : 'Save Challan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
