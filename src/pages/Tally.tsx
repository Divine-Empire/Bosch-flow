import { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Search, Download, Loader2 } from 'lucide-react';
import { Enquiry, Item } from '../types';
import { fetchSheet, updateRow, uploadFileToDrive } from '../utils/api';

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
  // Tally mappings
  PLANNED_6: 55, // BD
  ACTUAL_6: 56,  // BE
  DELAY_6: 57,   // BF
  INVOICE_PLAN_DATE: 58, // BG
  INVOICE_POSTED_BY: 59, // BH
  SPARE_INVOICE_NO: 60, // BI
  SPARE_INVOICE_FILE: 61, // BJ
  SERVICE_INVOICE_NO: 62, // BK
  SERVICE_INVOICE_FILE: 63, // BL
  TALLY_REMARKS: 64, // BM
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

    // Tally ReadOnly Lookups
    quotationNumber: row[30] || '', // COL.QUOTATION_NUMBER
    paymentTerm: (row[40] as Enquiry['paymentTerm']) || undefined, // COL.PAYMENT_TERM
    seniorApproval: (row[43] as Enquiry['seniorApproval']) || undefined, // COL.SENIOR_APPROVAL
    seniorName: row[44] || '', // COL.SENIOR_NAME
    machineRepairStatus: (row[48] as Enquiry['machineRepairStatus']) || undefined, // COL.MACHINE_REPAIR_STATUS
    currentPaymentStatus: (row[53] as Enquiry['currentPaymentStatus']) || undefined, // BB

    // Tally Update Fields (BD -> BM)
    planned6: row[COL.PLANNED_6] ? String(row[COL.PLANNED_6]).trim() : '',
    actual6: row[COL.ACTUAL_6] ? String(row[COL.ACTUAL_6]).trim() : '',
    delay6: row[COL.DELAY_6] ? String(row[COL.DELAY_6]).trim() : '',
    invoicePlanDate: row[COL.INVOICE_PLAN_DATE] || undefined,
    invoicePostedBy: row[COL.INVOICE_POSTED_BY] || '',
    spareInvoiceNo: row[COL.SPARE_INVOICE_NO] || '',
    spareInvoiceFile: row[COL.SPARE_INVOICE_FILE] || '',
    serviceInvoiceNo: row[COL.SERVICE_INVOICE_NO] || '',
    serviceInvoiceFile: row[COL.SERVICE_INVOICE_FILE] || '',
    tallyRemarks: row[COL.TALLY_REMARKS] || '',

    rowIndex,
  };
}

export default function Tally() {
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
  const [postedByOptions, setPostedByOptions] = useState<string[]>([]);
  const [formData, setFormData] = useState<{
    invoicePlanDate: string;
    invoicePostedBy: string;
    spareInvoiceNo: string;
    spareInvoiceFile: string;
    serviceInvoiceNo: string;
    serviceInvoiceFile: string;
    tallyRemarks: string;
  }>({
    invoicePlanDate: '',
    invoicePostedBy: '',
    spareInvoiceNo: '',
    spareInvoiceFile: '',
    serviceInvoiceNo: '',
    serviceInvoiceFile: '',
    tallyRemarks: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, dropdownRows] = await Promise.all([
        fetchSheet(SHEET_NAME),
        fetchSheet('Master-Dropdown').catch(() => []),
      ]);

      const headerIndex = rows.findIndex(
        (row: any[]) => String(row[COL.INDENT_NUMBER]).trim().toLowerCase() === 'indent number'
      );
      const startIndex = headerIndex >= 0 ? headerIndex + 1 : DATA_START_INDEX;

      const parsed = rows
        .map((row, index) => rowToEnquiry(row, index + 1))
        .slice(startIndex)
        .filter(enq => {
          const indentId = enq.id;
          if (!indentId || !indentId.startsWith('IN-')) return false;
          const planned6 = enq.planned6;
          return (planned6 && planned6.length > 0);
        });

      setEnquiries(parsed);

      // Extract Invoice Posted By names from Master-Dropdown Column F (index 5)
      if (dropdownRows.length > 1) {
        const names = dropdownRows
          .slice(1)
          .map(row => String(row[5] ?? '').trim())
          .filter(val => val !== '');
        setPostedByOptions([...new Set(names)]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnquiry || !selectedEnquiry.rowIndex) return;

    setSubmitting(true);
    setError(null);

    try {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const timestampNoTz = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

      const newData: string[] = new Array(70).fill('');

      // Avoid touching Delay (BF) -> let Google Sheets calculate difference formula
      newData[COL.ACTUAL_6] = timestampNoTz; // BE
      newData[COL.INVOICE_PLAN_DATE] = formData.invoicePlanDate; // BG
      newData[COL.INVOICE_POSTED_BY] = formData.invoicePostedBy; // BH
      newData[COL.SPARE_INVOICE_NO] = formData.spareInvoiceNo; // BI
      newData[COL.SERVICE_INVOICE_NO] = formData.serviceInvoiceNo; // BK
      newData[COL.TALLY_REMARKS] = formData.tallyRemarks; // BM

      // Handle Files Concurrently
      const uploadPromises: Promise<void>[] = [];

      if (formData.spareInvoiceFile && formData.spareInvoiceFile !== selectedEnquiry.spareInvoiceFile) {
        if (formData.spareInvoiceFile.startsWith('data:')) {
          uploadPromises.push((async () => {
            const [header, base64] = formData.spareInvoiceFile.split(',');
            const mimeMatch = header.match(/:([^;]+);/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'application/pdf';
            const ext = mimeType.split('/')[1] || 'pdf';
            const url = await uploadFileToDrive(base64, `spare_${selectedEnquiry.id}.${ext}`, mimeType);
            newData[COL.SPARE_INVOICE_FILE] = url; // BJ
          })());
        }
      } else {
        newData[COL.SPARE_INVOICE_FILE] = selectedEnquiry.spareInvoiceFile || '';
      }

      if (formData.serviceInvoiceFile && formData.serviceInvoiceFile !== selectedEnquiry.serviceInvoiceFile) {
        if (formData.serviceInvoiceFile.startsWith('data:')) {
          uploadPromises.push((async () => {
            const [header, base64] = formData.serviceInvoiceFile.split(',');
            const mimeMatch = header.match(/:([^;]+);/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'application/pdf';
            const ext = mimeType.split('/')[1] || 'pdf';
            const url = await uploadFileToDrive(base64, `service_${selectedEnquiry.id}.${ext}`, mimeType);
            newData[COL.SERVICE_INVOICE_FILE] = url; // BL
          })());
        }
      } else {
        newData[COL.SERVICE_INVOICE_FILE] = selectedEnquiry.serviceInvoiceFile || '';
      }

      await Promise.all(uploadPromises);
      await updateRow(SHEET_NAME, selectedEnquiry.rowIndex, newData);

      setEnquiries((prev) =>
        prev.map((enq) =>
          enq.id === selectedEnquiry.id
            ? {
              ...enq,
              actual6: timestampNoTz,
              invoicePlanDate: formData.invoicePlanDate,
              invoicePostedBy: formData.invoicePostedBy,
              spareInvoiceNo: formData.spareInvoiceNo,
              spareInvoiceFile: newData[COL.SPARE_INVOICE_FILE],
              serviceInvoiceNo: formData.serviceInvoiceNo,
              serviceInvoiceFile: newData[COL.SERVICE_INVOICE_FILE],
              tallyRemarks: formData.tallyRemarks,
            }
            : enq
        )
      );

      setShowModal(false);
      setSelectedEnquiry(null);
      resetForm();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update Tally');
    } finally {
      setSubmitting(false);
    }
  }, [selectedEnquiry, formData]);

  const resetForm = useCallback(() => {
    setFormData({
      invoicePlanDate: '',
      invoicePostedBy: '',
      spareInvoiceNo: '',
      spareInvoiceFile: '',
      serviceInvoiceNo: '',
      serviceInvoiceFile: '',
      tallyRemarks: '',
    });
  }, []);

  const openModal = useCallback((enquiry: Enquiry) => {
    setSelectedEnquiry(enquiry);
    setFormData({
      invoicePlanDate: enquiry.invoicePlanDate || '',
      invoicePostedBy: enquiry.invoicePostedBy || '',
      spareInvoiceNo: enquiry.spareInvoiceNo || '',
      spareInvoiceFile: enquiry.spareInvoiceFile || '',
      serviceInvoiceNo: enquiry.serviceInvoiceNo || '',
      serviceInvoiceFile: enquiry.serviceInvoiceFile || '',
      tallyRemarks: enquiry.tallyRemarks || '',
    });
    setShowModal(true);
  }, []);

  // Pending: planned6 exists AND actual6 is empty
  const pendingEnquiries = useMemo(() => {
    return enquiries.filter((e) => e.planned6 && e.planned6.length > 0 && (!e.actual6 || e.actual6.length === 0));
  }, [enquiries]);

  // History: planned6 and actual6 both exist
  const historyEnquiries = useMemo(() => {
    return enquiries.filter((e) => e.planned6 && e.planned6.length > 0 && e.actual6 && e.actual6.length > 0);
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
          <span>Loading Tally logs...</span>
        </div>
      ) : (
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
                        <div className="grid grid-cols-3 gap-2 mb-2 pb-2 border-b border-gray-200">
                          <div>
                            <span className="text-gray-500 text-xs block uppercase">Planned</span>
                            <span className="font-medium text-gray-900">{enquiry.planned6?.substring(0, 10) || '-'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs block uppercase">Actual</span>
                            <span className="font-medium text-gray-900">{enquiry.actual6?.substring(0, 10) || '-'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs block uppercase">Delay</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium inline-block mt-0.5 ${parseInt(enquiry.delay6 || '0') > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                              {enquiry.delay6 || '0'} Days
                            </span>
                          </div>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-gray-500">Plan Date:</span>
                          <span>{enquiry.invoicePlanDate}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Posted By:</span>
                          <span>{enquiry.invoicePostedBy}</span>
                        </div>

                        {enquiry.tallyRemarks && (
                          <p className="text-gray-600 italic text-xs pt-2 border-t border-gray-200 text-left mt-2">
                            Remark: "{enquiry.tallyRemarks}"
                          </p>
                        )}
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
                  {activeTab === 'pending' && (
                    <>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Payment Term</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Senior Approval</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Senior Name</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Machine Repair</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Payment Status</th>
                    </>
                  )}

                  {activeTab === 'history' && (
                    <>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Planned Date</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Actual Date</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Delay Time</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Posted By</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Spare Inv No</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Spare Inv</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Service Inv No</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Service Inv</th>
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
                    <td className="px-4 py-3">{enquiry.quotationNumber}</td>
                    {activeTab === 'pending' && (
                      <>
                        <td className="px-4 py-3">{enquiry.paymentTerm || '-'}</td>
                        <td className="px-4 py-3">{enquiry.seniorApproval || '-'}</td>
                        <td className="px-4 py-3">{enquiry.seniorName || '-'}</td>
                        <td className="px-4 py-3">{enquiry.machineRepairStatus}</td>
                        <td className="px-4 py-3">{enquiry.currentPaymentStatus}</td>
                      </>
                    )}

                    {activeTab === 'history' && (
                      <>
                        <td className="px-4 py-3 whitespace-nowrap">{enquiry.planned6?.substring(0, 10) || '-'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{enquiry.actual6?.substring(0, 10) || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${parseInt(enquiry.delay6 || '0') > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {enquiry.delay6 || '0'} Days
                          </span>
                        </td>
                        <td className="px-4 py-3">{enquiry.invoicePostedBy}</td>
                        <td className="px-4 py-3">{enquiry.spareInvoiceNo || '-'}</td>
                        <td className="px-4 py-3">
                          {enquiry.spareInvoiceFile ? (
                            <a href={enquiry.spareInvoiceFile} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                              <Download size={14} /> View
                            </a>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3">{enquiry.serviceInvoiceNo || '-'}</td>
                        <td className="px-4 py-3">
                          {enquiry.serviceInvoiceFile ? (
                            <a href={enquiry.serviceInvoiceFile} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                              <Download size={14} /> View
                            </a>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 max-w-xs truncate" title={enquiry.tallyRemarks}>{enquiry.tallyRemarks || '-'}</td>
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
      )}

      {showModal && selectedEnquiry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="bg-blue-600 text-white px-6 py-4 flex justify-between items-center rounded-t-lg shrink-0">
              <h2 className="text-xl font-bold">Process Tally</h2>
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
                  <select
                    value={formData.invoicePostedBy}
                    onChange={(e) => setFormData({ ...formData, invoicePostedBy: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select Person</option>
                    {postedByOptions.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Remarks</label>
                  <textarea
                    value={formData.tallyRemarks}
                    onChange={(e) => setFormData({ ...formData, tallyRemarks: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Enter any tally remarks..."
                  ></textarea>
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
                  {submitting ? 'Saving...' : 'Save Tally'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
