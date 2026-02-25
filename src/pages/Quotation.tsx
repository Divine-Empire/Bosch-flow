import { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Search, Download, Loader2 } from 'lucide-react';
import { Enquiry, Item } from '../types';
import { fetchSheet, updateRow, uploadFileToDrive, formatTimestamp } from '../utils/api';

const SHEET_NAME = 'Indent';
const DATA_START_INDEX = 7;

// Same indices derived from row structure
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
  GST_AMOUNT: 80, // Col CC
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

    // Challan
    planned1: row[COL.PLANNED_1] ? String(row[COL.PLANNED_1]) : '',
    actual1: row[COL.ACTUAL_1] ? String(row[COL.ACTUAL_1]) : '',
    delay1: row[COL.DELAY_1] ? String(row[COL.DELAY_1]) : '',
    machineReceived: (row[COL.MACHINE_RECEIVED] as 'Yes' | 'No') || undefined,
    challanFile: row[COL.UPLOAD_CHALLAN] || '',
    remarks: row[COL.REMARKS_1] || '',

    // Quotation
    planned2: row[COL.PLANNED_2] ? String(row[COL.PLANNED_2]).trim() : '',
    actual2: row[COL.ACTUAL_2] ? String(row[COL.ACTUAL_2]).trim() : '',
    delay2: row[COL.DELAY_2] ? String(row[COL.DELAY_2]).trim() : '',
    shareQuestions: (row[COL.SHARE_QUESTIONS] as 'Yes' | 'No') || undefined,
    quotationNumber: row[COL.QUOTATION_NUMBER] || '',
    valueBasic: row[COL.VALUE_BASIC] || '',
    gstAmount: row[COL.GST_AMOUNT] || '',
    quotationFile: row[COL.QUOTATION_FILE] || '',
    quotationRemarks: row[COL.QUOTATION_REMARKS] || '',

    rowIndex,
  };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Quotation() {
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
  const [quotationFileObj, setQuotationFileObj] = useState<File | null>(null);

  const [formData, setFormData] = useState<{
    shareQuestions: 'Yes' | 'No' | '';
    quotationNumber: string;
    valueBasic: string;
    gstAmount: string;
    quotationRemarks: string;
  }>({
    shareQuestions: '',
    quotationNumber: '',
    valueBasic: '',
    gstAmount: '',
    quotationRemarks: '',
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

      const parsed: Enquiry[] = [];
      for (let i = startIndex; i < rows.length; i++) {
        const row = rows[i];
        if (row[COL.INDENT_NUMBER] && String(row[COL.INDENT_NUMBER]).startsWith('IN-')) {
          const enq = rowToEnquiry(row, i + 1);
          // Quotation applies to any enquiry that reaches this stage
          parsed.push(enq);
        }
      }
      console.log('Parsed Enquiries for Quotation:', parsed.map(e => ({ id: e.id, planned2: e.planned2, actual2: e.actual2 })));
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
    setQuotationFileObj(e.target.files?.[0] ?? null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnquiry || !selectedEnquiry.rowIndex) return;

    if (!quotationFileObj && !selectedEnquiry.quotationFile) {
      alert('Please upload quotation file');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const actualTimestamp = formatTimestamp(new Date());

      // 1. Prepare sparse array immediately
      const rowData = new Array(81).fill('');
      rowData[COL.ACTUAL_2] = actualTimestamp;
      rowData[COL.SHARE_QUESTIONS] = formData.shareQuestions;
      rowData[COL.QUOTATION_NUMBER] = formData.quotationNumber;
      rowData[COL.VALUE_BASIC] = formData.valueBasic;
      rowData[COL.GST_AMOUNT] = formData.gstAmount;
      rowData[COL.QUOTATION_REMARKS] = formData.quotationRemarks;

      let finalFileUrl = selectedEnquiry.quotationFile || '';

      // 2. Parallelize: Upload file (if new) AND Update Sheet simultaneously
      const promises: Promise<any>[] = [];

      // Promise A: File Upload
      if (quotationFileObj) {
        promises.push(
          (async () => {
            const base64 = await fileToBase64(quotationFileObj);
            finalFileUrl = await uploadFileToDrive(base64, quotationFileObj.name, quotationFileObj.type);
            // After file uploads, update just that specific cell with the URL
            const urlRowData = new Array(34).fill('');
            urlRowData[COL.QUOTATION_FILE] = finalFileUrl;
            await updateRow(SHEET_NAME, selectedEnquiry.rowIndex!, urlRowData);
          })()
        );
      } else {
        // If no new file, just ensure the existing URL is explicitly kept or ignored (sparse ignores empty strings, so doing nothing is fine)
      }

      // Promise B: Update textual data
      promises.push(updateRow(SHEET_NAME, selectedEnquiry.rowIndex, rowData));

      // 3. Optimistically update UI so the user doesn't wait
      setEnquiries(prev =>
        prev.map(enq =>
          enq.id === selectedEnquiry.id
            ? {
              ...enq,
              actual2: actualTimestamp,
              shareQuestions: formData.shareQuestions as 'Yes' | 'No',
              quotationNumber: formData.quotationNumber,
              valueBasic: formData.valueBasic,
              gstAmount: formData.gstAmount,
              // optimistically use existing URL or assume new one is uploading
              quotationFile: finalFileUrl,
              quotationRemarks: formData.quotationRemarks,
            }
            : enq
        )
      );

      // Close modal instantly
      setShowModal(false);
      setSelectedEnquiry(null);
      setFormData({ shareQuestions: '', quotationNumber: '', valueBasic: '', gstAmount: '', quotationRemarks: '' });
      setQuotationFileObj(null);

      // Wait for background tasks to finish without locking UI
      await Promise.all(promises);

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save quotation');
    } finally {
      setSubmitting(false);
    }
  };

  const openModal = (enquiry: Enquiry) => {
    setSelectedEnquiry(enquiry);
    setFormData({
      shareQuestions: enquiry.shareQuestions || '',
      quotationNumber: enquiry.quotationNumber || '',
      valueBasic: enquiry.valueBasic || '',
      gstAmount: enquiry.gstAmount || '',
      quotationRemarks: enquiry.quotationRemarks || '',
    });
    setQuotationFileObj(null);
    setShowModal(true);
  };

  // ── Filters & Derivations (Memoized for Performance) ────────────────────

  // Pending: planned2 exists AND actual2 doesn't exist
  const pendingEnquiries = useMemo(() => {
    return enquiries.filter((e) => e.planned2 && e.planned2.length > 0 && !e.actual2);
  }, [enquiries]);

  // History: actual2 exists (Quotation processed)
  const historyEnquiries = useMemo(() => {
    return enquiries.filter((e) => e.actual2 && e.actual2.length > 0);
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
  }, [searchTerm, companyFilter, dateFilter]);

  const filteredPending = useMemo(() => filterEnquiries(pendingEnquiries), [filterEnquiries, pendingEnquiries]);
  const filteredHistory = useMemo(() => filterEnquiries(historyEnquiries), [filterEnquiries, historyEnquiries]);

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
          <span>Loading quotations…</span>
        </div>
      ) : (
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
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium inline-block mt-1 ${enquiry.machineReceived === 'Yes' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
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
                          <span className="text-gray-600">Basic Value:</span>
                          <span className="font-medium text-blue-900">{enquiry.valueBasic}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">GST:</span>
                          <span className="font-medium text-blue-900">{enquiry.gstAmount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Share Questions:</span>
                          <span className="font-medium text-blue-900">{enquiry.shareQuestions}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Remarks:</span>
                          <span className="font-medium text-blue-900">{enquiry.quotationRemarks}</span>
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
                      <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Basic Value</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">GST</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">File</th>
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
                        <td className="px-4 py-3">{enquiry.valueBasic}</td>
                        <td className="px-4 py-3">{enquiry.gstAmount}</td>
                        <td className="px-4 py-3">
                          {enquiry.quotationFile ? (
                            <a href={enquiry.quotationFile} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                              <Download size={14} /> View
                            </a>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3">{enquiry.quotationRemarks}</td>
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
      )}

      {showModal && selectedEnquiry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg w-full max-w-3xl my-8">
            <div className="bg-blue-600 text-white px-6 py-4 flex justify-between items-center rounded-t-lg">
              <h2 className="text-xl font-bold">Process Quotation</h2>
              <button onClick={() => setShowModal(false)} className="hover:text-gray-200">
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
                    <span className="font-medium text-gray-700">Machine Received:</span>
                    <p className="text-gray-900">{selectedEnquiry.machineReceived}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">HO Bill Address:</span>
                    <p className="text-gray-900">{selectedEnquiry.hoBillAddress}</p>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Basic Value <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={formData.valueBasic}
                      onChange={(e) => setFormData({ ...formData, valueBasic: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      GST Value <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={formData.gstAmount}
                      onChange={(e) => setFormData({ ...formData, gstAmount: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      File (Upload Image) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="file"
                      onChange={handleFileUpload}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      accept="image/*,.pdf"
                    />
                    {selectedEnquiry.quotationFile && !quotationFileObj && (
                      <p className="text-xs text-gray-500 mt-1">Existing file uploaded</p>
                    )}
                    {quotationFileObj && (
                      <p className="text-xs text-green-600 mt-1">Selected: {quotationFileObj.name}</p>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Remarks
                    </label>
                    <input
                      type="text"
                      value={formData.quotationRemarks}
                      onChange={(e) => setFormData({ ...formData, quotationRemarks: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                    setFormData({ shareQuestions: '', quotationNumber: '', valueBasic: '', gstAmount: '', quotationRemarks: '' });
                    setQuotationFileObj(null);
                  }}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  disabled={submitting}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 size={16} className="animate-spin" />}
                  {submitting ? 'Saving…' : 'Save Quotation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
