export interface Item {
  id?: string;
  itemName: string;
  modelName: string;
  qty: number;
  partNo: string;
}

export interface Enquiry {
  id: string; // Indent Number (IN-001, etc.)
  enquiryType: 'Service' | 'Sales' | 'Both';
  clientType: 'New' | 'Existing';
  companyName: string;
  contactPersonName: string;
  contactPersonNumber: string;
  hoBillAddress: string;
  location: string;
  gstNumber: string;
  clientEmailId: string;
  priority: 'Hot' | 'Warm' | 'Cold';
  warrantyCheck: 'Yes' | 'No';
  warrantyLastDate?: string;
  billAttach?: string; // URL or base64
  items: Item[];
  receiverName: string;
  createdAt: string;

  // Challan Receipt
  machineReceived?: 'Yes' | 'No';
  challanFile?: string;

  // Quotation
  shareQuestions?: 'Yes' | 'No';
  quotationNumber?: string;
  valueBasicWithGst?: string;
  quotationFile?: string;

  // Follow Up
  followUpStatus?: 'Flw-Up' | 'Order Received';
  whatDidCustomerSay?: string;
  paymentTerm?: 'Advance' | 'Credit';
  advanceValue?: string;
  paymentAttachment?: string;
  seniorApproval?: 'Yes' | 'No';
  seniorName?: string;

  // Repair Status
  machineRepairStatus?: 'Complete' | 'Pending';
  repairRemarks?: string;

  // Payment Status
  currentPaymentStatus?: 'Complete' | 'Pending';

  // Tally
  invoicePlanDate?: string;
  invoicePostedBy?: string;
  spareInvoiceNo?: string;
  spareInvoiceFile?: string;
  serviceInvoiceNo?: string;
  serviceInvoiceFile?: string;

  // Handover
  handoverStatus?: 'Complete' | 'Pending';
  handoverBy?: string;
  handoverDate?: string;
  handoverTo?: string;
  handoverToContactNo?: string;
  handoverChallanFile?: string;

  // Feedback
  feedbackStatus?: 'Complete' | 'Pending';
  feedbackRemarks?: string;
}
