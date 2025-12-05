import { useState, useEffect } from 'react';
import { Plus, X, Download } from 'lucide-react';
import { Enquiry, Item } from '../types';
import { storage } from '../utils/storage';

export default function EnquiryIndent() {
  const [showModal, setShowModal] = useState(false);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [formData, setFormData] = useState<Omit<Enquiry, 'id' | 'createdAt'>>({
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
  });

  useEffect(() => {
    setEnquiries(storage.getEnquiries());
  }, []);

  const handleInputChange = (field: keyof Enquiry, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleItemChange = (index: number, field: keyof Item, value: string | number) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const addItem = () => {
    if (formData.items.length < 10) {
      setFormData({
        ...formData,
        items: [...formData.items, { id: Date.now().toString(), itemName: '', modelName: '', qty: 0, partNo: '' }],
      });
    }
  };

  const removeItem = (index: number) => {
    if (formData.items.length > 1) {
      const newItems = formData.items.filter((_, i) => i !== index);
      setFormData({ ...formData, items: newItems });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, billAttach: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newEnquiry: Enquiry = {
      ...formData,
      id: storage.getNextIndentNumber(),
      createdAt: new Date().toISOString(),
    };
    const updatedEnquiries = storage.saveEnquiry(newEnquiry);
    setEnquiries(updatedEnquiries);
    setShowModal(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
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
      items: [{ id: Date.now().toString(), itemName: '', modelName: '', qty: 0, partNo: '' }],
      receiverName: '',
    });
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Enquiry Indent</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Add Enquiry
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {/* Mobile View - Cards */}
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
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        enquiry.priority === 'Hot'
                          ? 'bg-red-100 text-red-700'
                          : enquiry.priority === 'Warm'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {enquiry.priority}
                    </span>
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
                    <div>
                      <span className="text-xs text-gray-400 block">Location</span>
                      {enquiry.location}
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block">Receiver</span>
                      {enquiry.receiverName}
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

                  {enquiry.billAttach && (
                    <a
                      href={enquiry.billAttach}
                      download="bill"
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

        {/* Desktop View - Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Indent Number</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Enquiry Type</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Client Type</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Company Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Contact Person Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Contact Person Number</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">HO Bill Address</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Location</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">GST Number</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Client Email Id</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Priority</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Warranty Check</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Warranty Last Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Bill Attach</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Items Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Model Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Qty</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Part No</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 uppercase">Receiver Name</th>
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
                  <td className="px-4 py-3">
                    {enquiry.billAttach ? (
                      <a href={enquiry.billAttach} download="bill" className="text-blue-600 hover:underline flex items-center gap-1">
                        <Download size={14} /> View
                      </a>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    {enquiry.items.map((item, i) => (
                      <div key={i} className="border-b last:border-0 py-1 whitespace-nowrap">
                        {item.itemName}
                      </div>
                    ))}
                  </td>
                  <td className="px-4 py-3">
                    {enquiry.items.map((item, i) => (
                      <div key={i} className="border-b last:border-0 py-1 whitespace-nowrap">
                        {item.modelName}
                      </div>
                    ))}
                  </td>
                  <td className="px-4 py-3">
                    {enquiry.items.map((item, i) => (
                      <div key={i} className="border-b last:border-0 py-1 whitespace-nowrap">
                        {item.qty}
                      </div>
                    ))}
                  </td>
                  <td className="px-4 py-3">
                    {enquiry.items.map((item, i) => (
                      <div key={i} className="border-b last:border-0 py-1 whitespace-nowrap">
                        {item.partNo}
                      </div>
                    ))}
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
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto my-8">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
              <h2 className="text-xl font-bold text-gray-800">Add New Enquiry</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Enquiry Type</label>
                  <select
                    value={formData.enquiryType}
                    onChange={(e) => handleInputChange('enquiryType', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="Sales">Sales</option>
                    <option value="Service">Service</option>
                    <option value="Both">Both</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Client Type</label>
                  <select
                    value={formData.clientType}
                    onChange={(e) => handleInputChange('clientType', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="New">New</option>
                    <option value="Existing">Existing</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => handleInputChange('companyName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Contact Person Name</label>
                  <input
                    type="text"
                    value={formData.contactPersonName}
                    onChange={(e) => handleInputChange('contactPersonName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Contact Person Number</label>
                  <input
                    type="tel"
                    value={formData.contactPersonNumber}
                    onChange={(e) => handleInputChange('contactPersonNumber', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">HO Bill Address</label>
                  <input
                    type="text"
                    value={formData.hoBillAddress}
                    onChange={(e) => handleInputChange('hoBillAddress', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">GST Number</label>
                  <input
                    type="text"
                    value={formData.gstNumber}
                    onChange={(e) => handleInputChange('gstNumber', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Client Email ID</label>
                  <input
                    type="email"
                    value={formData.clientEmailId}
                    onChange={(e) => handleInputChange('clientEmailId', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => handleInputChange('priority', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="Hot">Hot</option>
                    <option value="Warm">Warm</option>
                    <option value="Cold">Cold</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Warranty Check</label>
                  <select
                    value={formData.warrantyCheck}
                    onChange={(e) => handleInputChange('warrantyCheck', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>

                {formData.warrantyCheck === 'Yes' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Warranty Last Date</label>
                    <input
                      type="date"
                      value={formData.warrantyLastDate}
                      onChange={(e) => handleInputChange('warrantyLastDate', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bill Attach</label>
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    accept="image/*,.pdf"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Receiver Name</label>
                  <input
                    type="text"
                    value={formData.receiverName}
                    onChange={(e) => handleInputChange('receiverName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="border-t pt-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Items</h3>
                  <button
                    type="button"
                    onClick={addItem}
                    disabled={formData.items.length >= 10}
                    className="flex items-center gap-1 bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
                  >
                    <Plus size={16} />
                    Add Item ({formData.items.length}/10)
                  </button>
                </div>

                <div className="space-y-4">
                  {formData.items.map((item, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-medium text-gray-700">Item {index + 1}</span>
                        {formData.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X size={18} />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                        <input
                          type="text"
                          placeholder="Item Name"
                          value={item.itemName}
                          onChange={(e) => handleItemChange(index, 'itemName', e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          required
                        />
                        <input
                          type="text"
                          placeholder="Model Name"
                          value={item.modelName}
                          onChange={(e) => handleItemChange(index, 'modelName', e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          required
                        />
                        <input
                          type="number"
                          placeholder="Qty"
                          value={item.qty}
                          onChange={(e) => handleItemChange(index, 'qty', parseInt(e.target.value) || 0)}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          required
                        />
                        <input
                          type="text"
                          placeholder="Part No"
                          value={item.partNo}
                          onChange={(e) => handleItemChange(index, 'partNo', e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
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
                  Save Enquiry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
