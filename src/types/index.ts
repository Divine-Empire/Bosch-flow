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
  planned1?: string;
  actual1?: string;
  delay1?: string;
  machineReceived?: 'Yes' | 'No';
  challanFile?: string; // Col Y: Upload Challan
  remarks?: string;

  rowIndex?: number; // Internal: 1-based index for GAS updateRow
  rawRow?: string[]; // Internal: Original GAS row string array to write back perfectly

  // Quotation
  planned2?: string;
  actual2?: string;
  delay2?: string;
  shareQuestions?: 'Yes' | 'No';
  quotationNumber?: string;
  valueBasic?: string;
  gstAmount?: string;
  quotationFile?: string;
  quotationRemarks?: string;

  // Follow Up
  planned3?: string;
  actual3?: string;
  delay3?: string;
  followUpStatus?: 'Flw-Up' | 'Order Received';
  nextDate?: string;
  whatDidCustomerSay?: string;
  paymentTerm?: 'Advance' | 'Credit';
  advanceValue?: string;
  paymentAttachment?: string;
  seniorApproval?: 'Yes' | 'No';
  seniorName?: string;

  // Repair Status
  planned4?: string;
  actual4?: string;
  delay4?: string;
  machineRepairStatus?: 'Complete' | 'Pending';
  repairRemarks?: string;

  // Payment Status
  planned5?: string;
  actual5?: string;
  delay5?: string;
  currentPaymentStatus?: 'Complete' | 'Pending';
  paymentRemarks?: string;

  // Tally
  planned6?: string;
  actual6?: string;
  delay6?: string;
  invoicePlanDate?: string;
  invoicePostedBy?: string;
  spareInvoiceNo?: string;
  spareInvoiceFile?: string;
  serviceInvoiceNo?: string;
  serviceInvoiceFile?: string;
  tallyRemarks?: string;

  // Handover
  planned7?: string;
  actual7?: string;
  delay7?: string;
  handoverStatus?: 'Complete' | 'Pending';
  handoverBy?: string;
  handoverDate?: string;
  handoverTo?: string;
  handoverToContactNo?: string;
  handoverChallanFile?: string;
  handoverRemarks?: string;

  // Feedback
  planned8?: string;
  actual8?: string;
  delay8?: string;
  feedbackStatus?: 'Complete' | 'Pending';
  feedbackRemarks?: string;
}
