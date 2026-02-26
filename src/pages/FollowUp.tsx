import { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Search, Download, Loader2 } from 'lucide-react';
import { Enquiry, Item } from '../types';
import { fetchSheet, insertRow, uploadFileToDrive } from '../utils/api';
import { useRefresh } from '../contexts/RefreshContext';

const SHEET_NAME = 'Indent';
const FOLLOW_UP_SHEET_NAME = 'Follow-Up';
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
  // Follow Up Lookups from Indent (Read-only for now based on user instruction)
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

    // Quotation (Read-only in Follow-up)
    shareQuestions: (row[COL.SHARE_QUESTIONS] as 'Yes' | 'No') || undefined,
    quotationNumber: row[COL.QUOTATION_NUMBER] || '',
    valueBasic: row[COL.VALUE_BASIC] || '',
    gstAmount: row[80] || '', // COL.GST_AMOUNT
    quotationFile: row[COL.QUOTATION_FILE] || '',

    // Follow Up Lookups
    planned3: row[COL.PLANNED_3] ? String(row[COL.PLANNED_3]).trim() : '',
    actual3: row[COL.ACTUAL_3] ? String(row[COL.ACTUAL_3]).trim() : '',
    delay3: row[COL.DELAY_3] ? String(row[COL.DELAY_3]).trim() : '',
    followUpStatus: (row[COL.FOLLOW_UP_STATUS] as Enquiry['followUpStatus']) || undefined,
    nextDate: row[COL.NEXT_DATE] || '',
    whatDidCustomerSay: row[COL.WHAT_DID_CUSTOMER_SAY] || '',
    paymentTerm: (row[COL.PAYMENT_TERM] as Enquiry['paymentTerm']) || undefined,
    advanceValue: row[COL.ADVANCE_VALUE] || '',
    paymentAttachment: row[COL.PAYMENT_ATTACHMENT] || '',
    seniorApproval: (row[COL.SENIOR_APPROVAL] as Enquiry['seniorApproval']) || undefined,
    seniorName: row[COL.SENIOR_NAME] || '',

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

export default function FollowUp() {
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

  const [paymentFileObj, setPaymentFileObj] = useState<File | null>(null);
  const [clientApprovalFileObj, setClientApprovalFileObj] = useState<File | null>(null);
  const [statusOptions, setStatusOptions] = useState<string[]>([]);
  const [nextSerialNumber, setNextSerialNumber] = useState<string>('SN-001');
  const { refreshCount, triggerRefresh } = useRefresh();

  const [formData, setFormData] = useState<{
    followUpStatus: string;
    nextDate: string;
    whatDidCustomerSay: string;
    paymentTerm: 'Advance' | 'Credit' | '';
    advanceValue: string;
    seniorApproval: 'Yes' | 'No' | '';
    seniorName: string;
  }>({
    followUpStatus: '',
    nextDate: '',
    whatDidCustomerSay: '',
    paymentTerm: '',
    advanceValue: '',
    seniorApproval: '',
    seniorName: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [indentRows, dropdownRows, followUpRows] = await Promise.all([
        fetchSheet(SHEET_NAME),
        fetchSheet('Master-Dropdown').catch(() => []),
        fetchSheet(FOLLOW_UP_SHEET_NAME).catch(() => [])
      ]);

      // Parse Indent Data
      const headerIndex = indentRows.findIndex(
        (row: any[]) => String(row[COL.INDENT_NUMBER]).trim().toLowerCase() === 'indent number'
      );
      const startIndex = headerIndex >= 0 ? headerIndex + 1 : DATA_START_INDEX;

      const parsed: Enquiry[] = [];
      for (let i = startIndex; i < indentRows.length; i++) {
        const row = indentRows[i];
        const indentId = String(row[COL.INDENT_NUMBER]);

        if (indentId && indentId.startsWith('IN-')) {
          const planned3 = String(row[COL.PLANNED_3] || '').trim();
          const actual3 = String(row[COL.ACTUAL_3] || '').trim();

          const isPending = planned3.length > 0 && actual3.length === 0;
          const isHistory = planned3.length > 0 && actual3.length > 0;

          if (isPending || isHistory) {
            parsed.push(rowToEnquiry(row, i + 1));
          }
        }
      }
      setEnquiries(parsed);

      // Parse Dropdown Options (Column D -> Index 3)
      if (dropdownRows.length > 1) { // Skip header
        const options = dropdownRows.slice(1)
          .map(row => row[3]) // Col D is index 3
          .filter(val => val && String(val).trim() !== '');
        setStatusOptions([...new Set(options)]);
      } else {
        // Fallback if sheet is empty or misses
        setStatusOptions(['Follow-up', 'Order Received', 'Order Cancelled']);
      }

      // Parse Follow-Up Serial Number (Column B -> Index 1)
      let maxSn = 0;
      // Search backwards to hopefully find the highest SN quickly if it's naturally sorted
      for (let i = followUpRows.length - 1; i >= 1; i--) { // Skip header
        const snCell = followUpRows[i][1];
        if (snCell && typeof snCell === 'string' && snCell.startsWith('SN-')) {
          const num = parseInt(snCell.split('-')[1], 10);
          if (!isNaN(num) && num > maxSn) maxSn = num;
        }
      }
      setNextSerialNumber(`SN-${String(maxSn + 1).padStart(3, '0')}`);

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, refreshCount]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPaymentFileObj(e.target.files?.[0] ?? null);
  };

  const handleClientApprovalUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setClientApprovalFileObj(e.target.files?.[0] ?? null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnquiry || !selectedEnquiry.rowIndex) return;

    if (formData.followUpStatus === 'Order Received' && formData.paymentTerm === 'Advance' && !paymentFileObj && !selectedEnquiry.paymentAttachment) {
      alert('Please upload payment attachment');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const now = new Date();
      // YYYY-MM-DD HH:mm:ss
      const pad = (n: number) => String(n).padStart(2, '0');
      const timestampNoTz = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

      let finalFileUrl = selectedEnquiry.paymentAttachment || '';

      // Upload file immediately if required
      if (paymentFileObj && formData.followUpStatus === 'Order Received' && formData.paymentTerm === 'Advance') {
        const base64 = await fileToBase64(paymentFileObj);
        finalFileUrl = await uploadFileToDrive(base64, paymentFileObj.name, paymentFileObj.type);
      }

      // Prepare row for Follow-Up sheet
      // A (0): Timestamp
      // B (1): Serial No
      // C (2): Indent No
      // D (3): Status
      // E (4): Next Date
      // F (5): What Did Customer Say (Remarks)
      // G (6): Payment Term
      // H (7): Advance Value
      // I (8): Attachment
      // J (9): Senior Approval
      // K (10): Senior Name
      // L (11): Client Approval

      let clientApprovalUrl = '';
      if (clientApprovalFileObj && formData.followUpStatus === 'Order Received') {
        const base64CA = await fileToBase64(clientApprovalFileObj);
        clientApprovalUrl = await uploadFileToDrive(base64CA, clientApprovalFileObj.name, clientApprovalFileObj.type);
      }

      const newFollowupRow = new Array(12).fill('');
      newFollowupRow[0] = timestampNoTz;
      newFollowupRow[1] = nextSerialNumber;
      newFollowupRow[2] = selectedEnquiry.id;
      newFollowupRow[3] = formData.followUpStatus;
      newFollowupRow[11] = clientApprovalUrl;

      if (formData.followUpStatus.toLowerCase().includes('follow-up')) {
        newFollowupRow[4] = formData.nextDate;
        newFollowupRow[5] = formData.whatDidCustomerSay;
      } else if (formData.followUpStatus === 'Order Received') {
        newFollowupRow[6] = formData.paymentTerm;
        if (formData.paymentTerm === 'Advance') {
          newFollowupRow[7] = formData.advanceValue;
          newFollowupRow[8] = finalFileUrl;
        } else if (formData.paymentTerm === 'Credit') {
          newFollowupRow[9] = formData.seniorApproval;
          newFollowupRow[10] = formData.seniorName;
        }
      } else if (['Order Cancelled', 'Machine is fully under warranty'].includes(formData.followUpStatus)) {
        newFollowupRow[5] = formData.whatDidCustomerSay;
      } else {
        // Fallback based on dropdown selections we don't know yet
        newFollowupRow[4] = formData.nextDate;
        newFollowupRow[5] = formData.whatDidCustomerSay;
      }

      // Insert into Follow-Up sheet ONLY
      await insertRow(FOLLOW_UP_SHEET_NAME, newFollowupRow);

      // We do NOT write to the Indent sheet per user instruction

      // Optimistically update
      setEnquiries(prev =>
        prev
      );

      // Increment local SN for the very next immediate submission without full page refresh
      const currSnNum = parseInt(nextSerialNumber.split('-')[1], 10);
      setNextSerialNumber(`SN-${String(currSnNum + 1).padStart(3, '0')}`);

      // Notify other pages that data has changed
      triggerRefresh();

      setShowModal(false);
      setSelectedEnquiry(null);
      resetForm();

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save follow up');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      followUpStatus: '',
      nextDate: '',
      whatDidCustomerSay: '',
      paymentTerm: '',
      advanceValue: '',
      seniorApproval: '',
      seniorName: '',
    });
    setPaymentFileObj(null);
    setClientApprovalFileObj(null);
  };

  const openModal = (enquiry: Enquiry) => {
    setSelectedEnquiry(enquiry);
    // Since we don't save to indent anymore, we just start fresh every time
    setFormData({
      followUpStatus: '',
      nextDate: '',
      whatDidCustomerSay: '',
      paymentTerm: '',
      advanceValue: '',
      seniorApproval: '',
      seniorName: '',
    });
    setPaymentFileObj(null);
    setClientApprovalFileObj(null);
    setShowModal(true);
  };

  // Pending: planned3 exists AND actual3 is empty
  const pendingEnquiries = useMemo(() => {
    return enquiries.filter((e) => e.planned3 && e.planned3.length > 0 && (!e.actual3 || e.actual3.length === 0));
  }, [enquiries]);

  // History: planned3 and actual3 both exist
  const historyEnquiries = useMemo(() => {
    return enquiries.filter((e) => e.planned3 && e.planned3.length > 0 && e.actual3 && e.actual3.length > 0);
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
          <span>Loading follow-ups...</span>
        </div>
      ) : (
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
                      {activeTab === 'pending' && enquiry.nextDate && (
                        <p><span className="text-gray-400 text-xs uppercase mr-1">Next Date:</span> {enquiry.nextDate}</p>
                      )}
                      {activeTab === 'pending' && enquiry.whatDidCustomerSay && (
                        <p className="italic border-l-2 border-gray-300 pl-2">"{enquiry.whatDidCustomerSay}"</p>
                      )}
                      <div className="flex gap-4">
                        <p><span className="text-gray-400 text-xs uppercase mr-1">Quot #:</span> {enquiry.quotationNumber}</p>
                        <p><span className="text-gray-400 text-xs uppercase mr-1">Value:</span> {enquiry.valueBasic}</p>
                        <p><span className="text-gray-400 text-xs uppercase mr-1">GST:</span> {enquiry.gstAmount}</p>
                      </div>
                    </div>

                    {activeTab === 'history' && (
                      <div className="bg-gray-50 p-3 rounded space-y-2 text-sm border border-gray-100">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 font-medium">Status</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${enquiry.followUpStatus === 'Order Received' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
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
                        <a href={enquiry.quotationFile} target="_blank" rel="noreferrer" className="text-blue-600 flex items-center gap-1 hover:underline">
                          <Download size={14} /> Quotation
                        </a>
                      )}
                      {enquiry.paymentAttachment && (
                        <a href={enquiry.paymentAttachment} target="_blank" rel="noreferrer" className="text-blue-600 flex items-center gap-1 hover:underline">
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
                  <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Basic Value</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">GST Value</th>

                  {activeTab === 'pending' && (
                    <>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Next Date</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">What Customer Say</th>
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
                    <td className="px-4 py-3">{enquiry.valueBasic}</td>
                    <td className="px-4 py-3">{enquiry.gstAmount}</td>

                    {activeTab === 'pending' && (
                      <>
                        <td className="px-4 py-3">{enquiry.nextDate || '-'}</td>
                        <td className="px-4 py-3 max-w-xs truncate" title={enquiry.whatDidCustomerSay}>{enquiry.whatDidCustomerSay || '-'}</td>
                        <td className="px-4 py-3">{enquiry.machineReceived || '-'}</td>
                        <td className="px-4 py-3">{enquiry.shareQuestions || '-'}</td>
                        <td className="px-4 py-3">
                          {enquiry.quotationFile ? (
                            <a href={enquiry.quotationFile} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                              <Download size={14} /> View
                            </a>
                          ) : '-'}
                        </td>
                      </>
                    )}

                    {activeTab === 'history' && (
                      <>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${enquiry.followUpStatus === 'Order Received' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                            {enquiry.followUpStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 max-w-xs truncate" title={enquiry.whatDidCustomerSay}>{enquiry.whatDidCustomerSay || '-'}</td>
                        <td className="px-4 py-3">{enquiry.paymentTerm || '-'}</td>
                        <td className="px-4 py-3">{enquiry.advanceValue || '-'}</td>
                        <td className="px-4 py-3">
                          {enquiry.paymentAttachment ? (
                            <a href={enquiry.paymentAttachment} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
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
      )}

      {showModal && selectedEnquiry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg w-full max-w-2xl my-8">
            <div className="bg-blue-600 text-white px-6 py-4 flex justify-between items-center rounded-t-lg">
              <h2 className="text-xl font-bold">Process Follow Up</h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                  setError(null);
                }}
                disabled={submitting}
                className="hover:text-gray-200"
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
                    <span className="font-medium text-gray-700">Basic Value:</span>
                    <p className="text-gray-900">{selectedEnquiry.valueBasic}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">GST:</span>
                    <p className="text-gray-900">{selectedEnquiry.gstAmount}</p>
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
                    onChange={(e) => setFormData({ ...formData, followUpStatus: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select Option</option>
                    {statusOptions.map((opt, idx) => (
                      <option key={idx} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                {formData.followUpStatus.toLowerCase().includes('follow-up') && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Next Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={formData.nextDate}
                        onChange={(e) => setFormData({ ...formData, nextDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
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
                  </>
                )}

                {['Order Cancelled', 'Machine is fully under warranty'].includes(formData.followUpStatus) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Remarks <span className="text-red-500">*</span>
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

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Client Approval
                      </label>
                      <input
                        type="file"
                        onChange={handleClientApprovalUpload}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        accept="image/*,.pdf"
                      />
                      {clientApprovalFileObj && (
                        <p className="text-xs text-green-600 mt-1">Selected: {clientApprovalFileObj.name}</p>
                      )}
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
                            required={!selectedEnquiry.paymentAttachment}
                          />
                          {selectedEnquiry.paymentAttachment && !paymentFileObj && (
                            <p className="text-xs text-gray-500 mt-1">Existing file uploaded</p>
                          )}
                          {paymentFileObj && (
                            <p className="text-xs text-green-600 mt-1">Selected: {paymentFileObj.name}</p>
                          )}
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
                  disabled={submitting}
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
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 size={16} className="animate-spin" />}
                  {submitting ? 'Saving...' : 'Save Follow Up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
