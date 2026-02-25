import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, X, Download, Loader2, CloudCog } from 'lucide-react';
import { Enquiry, Item } from '../types';
import { fetchSheet, insertRow, uploadFileToDrive, formatTimestamp } from '../utils/api';
import { useRefresh } from '../contexts/RefreshContext';

// ─── Sheet constants ───────────────────────────────────────────────────────────
const SHEET_NAME = 'Indent';
// Row 7 is the header row (0-indexed: index 6). Data starts at index 7 (row 8).
const DATA_START_INDEX = 7;

// Column indices inside each data row (0-based)
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
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Parse a JSON cell value safely; fall back to an empty array. */
function parseJsonCell(value: string): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Map a raw sheet row (string[]) into an Enquiry object. */
function rowToEnquiry(row: string[]): Enquiry {
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
    createdAt: row[COL.TIMESTAMP] ?? new Date().toISOString(),
  };
}

/** Derive the next Indent Number (IN-001, IN-002 …) from loaded data. */
function getNextIndentNumber(enquiries: Enquiry[]): string {
  if (enquiries.length === 0) return 'IN-001';
  const max = enquiries.reduce((m, e) => {
    const n = parseInt(e.id.replace('IN-', ''), 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
  return `IN-${String(max + 1).padStart(3, '0')}`;
}

// ─── Default form state ────────────────────────────────────────────────────────
const defaultForm = (): Omit<Enquiry, 'id' | 'createdAt'> => ({
  enquiryType: 'Sales',
  clientType: 'New',
  companyName: '',
  contactPersonName: '',
  contactPersonNumber: '',
  hoBillAddress: '',
  location: '',
  gstNumber: '',
  clientEmailId: '',
  priority: 'Hot',
  warrantyCheck: 'No',
  items: [{ id: '1', itemName: '', modelName: '', qty: 0, partNo: '' }],
  receiverName: '',
  billAttach: '',
});

// ─── Types ─────────────────────────────────────────────────────────────────────
interface CompanyRecord {
  companyName: string;
  hoBillAddress: string;
  gstNumber: string;
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function EnquiryIndent() {
  const [showModal, setShowModal] = useState(false);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [receiverNames, setReceiverNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { refreshCount, triggerRefresh } = useRefresh();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [billFile, setBillFile] = useState<File | null>(null);
  const [formData, setFormData] = useState<Omit<Enquiry, 'id' | 'createdAt'>>(defaultForm());

  // State for Receiver Dropdown
  const [receiverDropdownOpen, setReceiverDropdownOpen] = useState(false);
  const [receiverSearch, setReceiverSearch] = useState('');

  // State for Company Dropdown
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const [companySearch, setCompanySearch] = useState('');

  // State for Item Details Modal
  const [viewItemsModal, setViewItemsModal] = useState<Item[] | null>(null);

  // O(1) lookup map: companyName → CompanyRecord — recomputed only when companies changes
  const companyMap = useMemo(
    () => new Map(companies.map(c => [c.companyName, c])),
    [companies]
  );

  // ── Load data from GAS sheet + Master-Dropdown in parallel ──────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [indentRows, dropdownRows] = await Promise.all([
        fetchSheet(SHEET_NAME),
        fetchSheet('Master-Dropdown'),
      ]);

      // Parse Indent sheet
      const headerIndex = indentRows.findIndex(
        row => String(row[COL.INDENT_NUMBER]).trim().toLowerCase() === 'indent number'
      );
      const startIndex = headerIndex >= 0 ? headerIndex + 1 : DATA_START_INDEX;
      const parsed = indentRows
        .slice(startIndex)
        .filter(row => row[COL.INDENT_NUMBER] && String(row[COL.INDENT_NUMBER]).startsWith('IN-'))
        .map(rowToEnquiry);
      setEnquiries(parsed);

      // Parse Master-Dropdown sheet (row 0 = header: Company Name, HO Bill Address, GST Number)
      const companyList: CompanyRecord[] = dropdownRows
        .slice(1) // skip header row
        .filter(row => row[0]) // skip empty rows
        .map(row => ({
          companyName: String(row[0]).trim(),
          hoBillAddress: String(row[1] ?? '').trim(),
          gstNumber: String(row[2] ?? '').trim(),
        }));
      setCompanies(companyList);

      // Extract Receiver Names from Master-Dropdown Column E (index 4)
      const receiverList: string[] = dropdownRows
        .slice(1) // skip header row
        .map(row => String(row[4] ?? '').trim())
        .filter(val => val !== '');
      setReceiverNames(Array.from(new Set(receiverList)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, refreshCount]);

  // ── Form handlers ────────────────────────────────────────────────────────
  const handleInputChange = (field: keyof Enquiry, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  /** When Client Type changes, clear company-related fields to avoid stale data. */
  const handleClientTypeChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      clientType: value as Enquiry['clientType'],
      companyName: '',
      hoBillAddress: '',
      gstNumber: '',
    }));
    setCompanySearch('');
  };

  /** When an existing company is selected, auto-fill HO Bill Address and GST Number. */
  const handleCompanySelect = (companyName: string) => {
    const record = companyMap.get(companyName); // O(1) Map lookup
    setFormData(prev => ({
      ...prev,
      companyName,
      hoBillAddress: record?.hoBillAddress ?? '',
      gstNumber: record?.gstNumber ?? '',
    }));
    setCompanySearch(companyName);
    setCompanyDropdownOpen(false);
  };

  const filteredCompanies = useMemo(() => {
    if (!companySearch.trim()) return companies;
    const lower = companySearch.toLowerCase().trim();
    return companies.filter(c => c.companyName.toLowerCase().includes(lower));
  }, [companies, companySearch]);

  const filteredReceivers = useMemo(() => {
    if (!receiverSearch.trim()) return receiverNames;
    const lower = receiverSearch.toLowerCase().trim();
    return receiverNames.filter(n => n.toLowerCase().includes(lower));
  }, [receiverNames, receiverSearch]);

  const handleItemChange = (index: number, field: keyof Item, value: string | number) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData(prev => ({ ...prev, items: newItems }));
  };

  const addItem = () => {
    if (formData.items.length < 15) {
      setFormData(prev => ({
        ...prev,
        items: [...prev.items, { id: Date.now().toString(), itemName: '', modelName: '', qty: 0, partNo: '' }],
      }));
    }
  };

  const removeItem = (index: number) => {
    if (formData.items.length > 1) {
      setFormData(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBillFile(e.target.files?.[0] ?? null);
  };

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      // 1. Upload bill attachment to Drive (if provided)
      let billAttachUrl = '';
      if (billFile) {
        const base64 = await fileToBase64(billFile);
        billAttachUrl = await uploadFileToDrive(base64, billFile.name, billFile.type);
      }

      // 2. Build the next Indent Number
      const indentNumber = getNextIndentNumber(enquiries);
      const timestamp = formatTimestamp(new Date());

      // 3. Serialize items as JSON arrays (one JSON per column)
      const itemNames = JSON.stringify(formData.items.map(i => i.itemName));
      const modelNames = JSON.stringify(formData.items.map(i => i.modelName));
      const qtys = JSON.stringify(formData.items.map(i => String(i.qty)));
      const partNos = JSON.stringify(formData.items.map(i => i.partNo));

      // 4. Build the row (must match sheet column order A→T)
      const row = [
        timestamp,                       // A: Timestamp
        indentNumber,                    // B: Indent Number
        formData.enquiryType,            // C: Enquiry Type
        formData.clientType,             // D: Client Type
        formData.companyName,            // E: Company Name
        formData.contactPersonName,      // F: Contact Person Name
        formData.contactPersonNumber,    // G: Contact Person Number
        formData.hoBillAddress,          // H: HO Bill Address
        formData.location,              // I: Location
        formData.gstNumber,              // J: GST Number
        formData.clientEmailId,          // K: Client Email Id
        formData.priority,               // L: Priority
        formData.warrantyCheck,          // M: Warranty Check
        formData.warrantyLastDate ?? '', // N: Warranty Last Date
        billAttachUrl,                   // O: Bill Attach (Drive URL)
        itemNames,                       // P: Items Name (JSON)
        modelNames,                      // Q: Model Name (JSON)
        qtys,                            // R: Qty (JSON)
        partNos,                         // S: Part No (JSON)
        formData.receiverName,           // T: Receiver Name
      ];

      // 5. Insert into GAS sheet
      await insertRow(SHEET_NAME, row);

      // 6. If New client, save company to Master-Dropdown (skip duplicates, non-blocking)
      if (
        formData.clientType === 'New' &&
        formData.companyName &&
        !companyMap.has(formData.companyName)
      ) {
        const newCompany: CompanyRecord = {
          companyName: formData.companyName,
          hoBillAddress: formData.hoBillAddress,
          gstNumber: formData.gstNumber,
        };
        // Fire-and-forget — does not block the form from closing
        insertRow('Master-Dropdown', [
          newCompany.companyName,
          newCompany.hoBillAddress,
          newCompany.gstNumber,
        ]).catch(console.error);
        // Update in-memory companies so dropdown reflects it immediately
        setCompanies(prev => [...prev, newCompany]);
      }

      // 7. Update local state optimistically
      const newEnquiry: Enquiry = {
        ...formData,
        id: indentNumber,
        createdAt: timestamp,
        billAttach: billAttachUrl,
      };
      setEnquiries(prev => [newEnquiry, ...prev]);

      // 8. Notify other pages that data has changed
      triggerRefresh();

      // 9. Reset
      setShowModal(false);
      setBillFile(null);
      setFormData(defaultForm());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save enquiry');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData(defaultForm());
    setBillFile(null);
    setError(null);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Enquiry Entry</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Add Enquiry
        </button>
      </div>

      {/* Error banner */}
      {error && !showModal && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {/* Loading state */}
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-gray-500">
            <Loader2 size={22} className="animate-spin" />
            <span>Loading enquiries…</span>
          </div>
        ) : (
          <>
            {/* Mobile View — Cards */}
            <div className="md:hidden">
              {enquiries.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No enquiries yet. Click "Add Enquiry" to create one.
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {enquiries.map((enquiry) => (
                    <div key={enquiry.id} className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                            {enquiry.id}
                          </span>
                          <h3 className="font-medium text-gray-900 mt-1">{enquiry.companyName}</h3>
                          <p className="text-xs text-gray-500">{enquiry.enquiryType} • {enquiry.clientType}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${enquiry.priority === 'Hot' ? 'bg-red-100 text-red-700'
                          : enquiry.priority === 'Warm' ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-blue-100 text-blue-700'
                          }`}>
                          {enquiry.priority}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                        <div><span className="text-xs text-gray-400 block">Contact</span>{enquiry.contactPersonName}</div>
                        <div><span className="text-xs text-gray-400 block">Phone</span>{enquiry.contactPersonNumber}</div>
                        <div><span className="text-xs text-gray-400 block">Location</span>{enquiry.location}</div>
                        <div><span className="text-xs text-gray-400 block">Receiver</span>{enquiry.receiverName}</div>
                      </div>

                      <div className="bg-gray-50 rounded p-2">
                        <p className="text-xs font-medium text-gray-500 mb-1">Items ({enquiry.items.length})</p>
                        <div className="space-y-1">
                          {enquiry.items.slice(0, 2).map((item, i) => (
                            <div key={i} className="text-xs text-gray-700 flex justify-between">
                              <span>{item.itemName}</span>
                              <span className="font-medium">Qty: {item.qty}</span>
                            </div>
                          ))}
                          {enquiry.items.length > 2 && (
                            <p className="text-xs text-gray-400 pt-1">+{enquiry.items.length - 2} more items</p>
                          )}
                        </div>
                      </div>

                      {enquiry.billAttach && (
                        <a
                          href={enquiry.billAttach}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 text-xs flex items-center gap-1 hover:underline"
                        >
                          <Download size={14} /> View Bill Attachment
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Desktop View — Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-max text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Enquiry Number', 'Enquiry Type', 'Client Type', 'Company Name', 'Contact Person Name',
                      'Contact Person Number', 'HO Bill Address', 'Location', 'GST Number', 'Client Email Id',
                      'Priority', 'Warranty Check', 'Warranty Last Date', 'Bill Attach',
                      'Item Details', 'Receiver Name'].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-medium text-gray-600 uppercase whitespace-nowrap">{h}</th>
                      ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {enquiries.map((enquiry) => (
                    <tr key={enquiry.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-blue-600">{enquiry.id}</td>
                      <td className="px-4 py-3">{enquiry.enquiryType}</td>
                      <td className="px-4 py-3">{enquiry.clientType}</td>
                      <td className="px-4 py-3">{enquiry.companyName}</td>
                      <td className="px-4 py-3">{enquiry.contactPersonName}</td>
                      <td className="px-4 py-3">{enquiry.contactPersonNumber}</td>
                      <td className="px-4 py-3 max-w-xs truncate" title={enquiry.hoBillAddress}>{enquiry.hoBillAddress}</td>
                      <td className="px-4 py-3">{enquiry.location}</td>
                      <td className="px-4 py-3">{enquiry.gstNumber}</td>
                      <td className="px-4 py-3">{enquiry.clientEmailId}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${enquiry.priority === 'Hot' ? 'bg-red-100 text-red-700'
                          : enquiry.priority === 'Warm' ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-blue-100 text-blue-700'
                          }`}>{enquiry.priority}</span>
                      </td>
                      <td className="px-4 py-3">{enquiry.warrantyCheck}</td>
                      <td className="px-4 py-3">{enquiry.warrantyLastDate ? enquiry.warrantyLastDate.slice(0, 10) : '-'}</td>
                      <td className="px-4 py-3">
                        {enquiry.billAttach
                          ? <a href={enquiry.billAttach} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1"><Download size={14} />View</a>
                          : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setViewItemsModal(enquiry.items)}
                          className="px-3 py-1 bg-blue-100 text-blue-700 font-medium text-xs rounded-full hover:bg-blue-200 transition-colors whitespace-nowrap"
                        >
                          View {enquiry.items.length} {enquiry.items.length === 1 ? 'Item' : 'Items'}
                        </button>
                      </td>
                      <td className="px-4 py-3">{enquiry.receiverName}</td>
                    </tr>
                  ))}
                  {enquiries.length === 0 && (
                    <tr>
                      <td colSpan={19} className="px-4 py-8 text-center text-gray-500">
                        No enquiries yet. Click "Add Enquiry" to create one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── Add Enquiry Modal ─────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto my-8">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
              <h2 className="text-xl font-bold text-gray-800">Add New Enquiry</h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Enquiry Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Enquiry Type</label>
                  <select value={formData.enquiryType} onChange={e => handleInputChange('enquiryType', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required>
                    <option value="Sales">Sales</option>
                    <option value="Service">Service</option>
                    <option value="Both">Both</option>
                  </select>
                </div>

                {/* Client Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Client Type</label>
                  <select value={formData.clientType} onChange={e => handleClientTypeChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required>
                    <option value="New">New</option>
                    <option value="Existing">Existing</option>
                  </select>
                </div>

                {/* Company Name — dropdown for Existing, free text for New */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
                  {formData.clientType === 'Existing' ? (
                    <div className="relative">
                      <input
                        type="text"
                        value={companySearch}
                        onChange={(e) => {
                          const typed = e.target.value;

                          console.log(typed);
                          const record = companyMap.get(typed);
                          setCompanySearch(typed);
                          setFormData(prev => ({
                            ...prev,
                            companyName: typed,
                            hoBillAddress: record?.hoBillAddress ?? '',
                            gstNumber: record?.gstNumber ?? '',
                          }));
                          setCompanyDropdownOpen(true);
                        }}
                        onFocus={() => setCompanyDropdownOpen(true)}
                        onBlur={() => setCompanyDropdownOpen(false)}
                        placeholder="Search or Select Company..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                        autoComplete="off"
                      />

                      {companyDropdownOpen && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 flex flex-col">
                          <div className="overflow-y-auto">
                            {filteredCompanies.length > 0 ? (
                              filteredCompanies.map((c, index) => (
                                <div
                                  key={index}
                                  className={`px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm ${formData.companyName === c.companyName
                                    ? 'bg-blue-50 text-blue-700 font-medium'
                                    : 'text-gray-700'
                                    }`}
                                  onMouseDown={(e) => {
                                    e.preventDefault(); // critical — prevents blur before selection
                                    handleCompanySelect(c.companyName);
                                  }}
                                >
                                  {c.companyName}
                                </div>
                              ))
                            ) : (
                              <div className="px-3 py-4 text-center text-sm text-gray-500">
                                No companies found
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <input type="text" value={formData.companyName} onChange={e => handleInputChange('companyName', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
                  )}
                </div>

                {/* Contact Person Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Contact Person Name</label>
                  <input type="text" value={formData.contactPersonName} onChange={e => handleInputChange('contactPersonName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
                </div>

                {/* Contact Person Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Contact Person Number</label>
                  <input type="tel" value={formData.contactPersonNumber} onChange={e => handleInputChange('contactPersonNumber', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
                </div>

                {/* HO Bill Address — read-only when Existing (auto-filled from company) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">HO Bill Address</label>
                  <input
                    type="text"
                    value={formData.hoBillAddress}
                    onChange={e => handleInputChange('hoBillAddress', e.target.value)}
                    readOnly={formData.clientType === 'Existing'}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 ${formData.clientType === 'Existing' ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''
                      }`}
                    required
                  />
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                  <input type="text" value={formData.location} onChange={e => handleInputChange('location', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
                </div>

                {/* GST Number — read-only when Existing (auto-filled from company) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">GST Number</label>
                  <input
                    type="text"
                    value={formData.gstNumber}
                    onChange={e => handleInputChange('gstNumber', e.target.value)}
                    readOnly={formData.clientType === 'Existing'}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 ${formData.clientType === 'Existing' ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''
                      }`}
                    required
                  />
                </div>

                {/* Client Email ID */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Client Email ID</label>
                  <input type="email" value={formData.clientEmailId} onChange={e => handleInputChange('clientEmailId', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                  <select value={formData.priority} onChange={e => handleInputChange('priority', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required>
                    <option value="Hot">Hot</option>
                    <option value="Warm">Warm</option>
                    <option value="Cold">Cold</option>
                  </select>
                </div>

                {/* Warranty Check */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Warranty Check</label>
                  <select value={formData.warrantyCheck} onChange={e => handleInputChange('warrantyCheck', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required>
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>

                {/* Warranty Last Date (conditional) */}
                {formData.warrantyCheck === 'Yes' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Warranty Last Date</label>
                    <input type="date" value={formData.warrantyLastDate ?? ''} onChange={e => handleInputChange('warrantyLastDate', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
                  </div>
                )}

                {/* Bill Attach */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bill Attach</label>
                  <input type="file" onChange={handleFileChange} accept="image/*,.pdf"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  {billFile && <p className="text-xs text-gray-500 mt-1">Selected: {billFile.name}</p>}
                </div>

                {/* Receiver Name — combobox */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Receiver Name</label>
                  <input
                    type="text"
                    value={receiverSearch}
                    onChange={(e) => {
                      setReceiverSearch(e.target.value);
                      setFormData(prev => ({ ...prev, receiverName: e.target.value }));
                      setReceiverDropdownOpen(true);
                    }}
                    onFocus={() => setReceiverDropdownOpen(true)}
                    onBlur={() => setReceiverDropdownOpen(false)}
                    placeholder="Search or Select Receiver..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoComplete="off"
                  />

                  {receiverDropdownOpen && filteredReceivers.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredReceivers.map((name) => (
                        <div
                          key={name}
                          className={`px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm ${formData.receiverName === name ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                            }`}
                          onMouseDown={(e) => {
                            e.preventDefault(); // prevents blur before selection
                            setReceiverSearch(name);
                            setFormData(prev => ({ ...prev, receiverName: name }));
                            setReceiverDropdownOpen(false);
                          }}
                        >
                          {name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Items Section */}
              <div className="border-t pt-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Items</h3>
                  <button type="button" onClick={addItem} disabled={formData.items.length >= 15}
                    className="flex items-center gap-1 bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed text-sm">
                    <Plus size={16} />
                    Add Item ({formData.items.length}/15)
                  </button>
                </div>

                {/* Desktop/Tablet Headers */}
                <div className="hidden sm:grid grid-cols-12 gap-3 mb-2 px-1 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <div className="col-span-3">Items Name</div>
                  <div className="col-span-3">Model Name</div>
                  <div className="col-span-2">Qty</div>
                  <div className="col-span-3">Part No</div>
                  <div className="col-span-1 text-center">Action</div>
                </div>

                <div className="space-y-4 sm:space-y-2">
                  {formData.items.map((item, index) => (
                    <div key={index} className="relative bg-gray-50 sm:bg-transparent p-4 sm:p-0 border border-gray-200 sm:border-none rounded-lg sm:rounded-none">
                      {/* Mobile Header */}
                      <div className="flex justify-between items-center mb-3 sm:hidden">
                        <span className="font-medium text-gray-700 text-sm">Item {index + 1}</span>
                        {formData.items.length > 1 && (
                          <button type="button" onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700 bg-red-50 p-1 rounded transition-colors">
                            <X size={16} />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                        <div className="col-span-1 sm:col-span-3">
                          <label className="block sm:hidden text-xs font-medium text-gray-500 mb-1">Items Name</label>
                          <input type="text" placeholder="Item Name" value={item.itemName}
                            onChange={e => handleItemChange(index, 'itemName', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" required />
                        </div>
                        <div className="col-span-1 sm:col-span-3">
                          <label className="block sm:hidden text-xs font-medium text-gray-500 mb-1">Model Name</label>
                          <input type="text" placeholder="Model Name" value={item.modelName}
                            onChange={e => handleItemChange(index, 'modelName', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" required />
                        </div>
                        <div className="col-span-1 sm:col-span-2">
                          <label className="block sm:hidden text-xs font-medium text-gray-500 mb-1">Qty</label>
                          <input type="number" placeholder="Qty" value={item.qty === 0 ? '' : item.qty}
                            onChange={e => handleItemChange(index, 'qty', parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" required />
                        </div>
                        <div className="col-span-1 sm:col-span-3">
                          <label className="block sm:hidden text-xs font-medium text-gray-500 mb-1">Part No</label>
                          <input type="text" placeholder="Part No" value={item.partNo}
                            onChange={e => handleItemChange(index, 'partNo', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" required />
                        </div>
                        <div className="hidden sm:flex col-span-1 justify-center items-center">
                          {formData.items.length > 1 && (
                            <button type="button" onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors" title="Remove Item">
                              <X size={18} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center gap-2">
                  {submitting && <Loader2 size={16} className="animate-spin" />}
                  {submitting ? 'Saving…' : 'Save Enquiry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── View Items Modal ────────────────────────────────────────────── */}
      {viewItemsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col shadow-xl">
            <div className="flex justify-between items-center p-4 border-b bg-gray-50 rounded-t-lg">
              <h3 className="font-semibold text-gray-800">Item Details</h3>
              <button
                onClick={() => setViewItemsModal(null)}
                className="text-gray-500 hover:text-gray-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="overflow-auto p-4">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-100 text-gray-600 font-medium">
                  <tr>
                    <th className="px-4 py-2 rounded-tl-md">Items Name</th>
                    <th className="px-4 py-2">Model Name</th>
                    <th className="px-4 py-2">Qty</th>
                    <th className="px-4 py-2 rounded-tr-md">Part No</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {viewItemsModal.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3">{item.itemName || '-'}</td>
                      <td className="px-4 py-3">{item.modelName || '-'}</td>
                      <td className="px-4 py-3">{item.qty || 0}</td>
                      <td className="px-4 py-3">{item.partNo || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {viewItemsModal.length === 0 && (
                <div className="text-center text-gray-500 py-6 border-b">
                  No items found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
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
