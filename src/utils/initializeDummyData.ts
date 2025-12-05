export function initializeDummyData() {
  if (localStorage.getItem('bosch_data_initialized') === 'true') {
    return;
  }

  const dummyEnquiries = [
    {
      indentNumber: 'IN-001',
      enquiryType: 'Service',
      clientType: 'Existing',
      companyName: 'Tech Solutions Pvt Ltd',
      contactPersonName: 'Rajesh Kumar',
      contactPersonNumber: '+91 9876543210',
      hoBillAddress: '123, Industrial Area, Phase 1, Mumbai, Maharashtra',
      location: 'Mumbai',
      gstNumber: '27AABCU9603R1ZM',
      clientEmailId: 'rajesh@techsolutions.com',
      priority: 'Hot',
      warrantyCheck: 'Yes',
      warrantyLastDate: '2025-06-15',
      billAttach: '',
      items: [
        {
          itemName: 'Rotary Hammer',
          modelName: 'GBH 2-28 DFV',
          qty: '2',
          partNo: 'BH228DFV',
        },
      ],
      receiverName: 'Suresh Patil',
    },
    {
      indentNumber: 'IN-002',
      enquiryType: 'Both',
      clientType: 'New',
      companyName: 'Mega Construction Ltd',
      contactPersonName: 'Priya Sharma',
      contactPersonNumber: '+91 9988776655',
      hoBillAddress: '456, Building Complex, Sector 15, Delhi',
      location: 'Delhi',
      gstNumber: '07AABCU9603R1ZN',
      clientEmailId: 'priya@megaconstruction.com',
      priority: 'Warm',
      warrantyCheck: 'No',
      warrantyLastDate: '',
      billAttach: '',
      items: [
        {
          itemName: 'Angle Grinder',
          modelName: 'GWS 750-100',
          qty: '5',
          partNo: 'GWS750100',
        },
        {
          itemName: 'Impact Drill',
          modelName: 'GSB 550',
          qty: '3',
          partNo: 'GSB550',
        },
      ],
      receiverName: 'Amit Verma',
    },
    {
      indentNumber: 'IN-003',
      enquiryType: 'Sales',
      clientType: 'New',
      companyName: 'Home Decor Enterprises',
      contactPersonName: 'Vikram Singh',
      contactPersonNumber: '+91 8877665544',
      hoBillAddress: '789, Market Street, Bangalore, Karnataka',
      location: 'Bangalore',
      gstNumber: '29AABCU9603R1ZO',
      clientEmailId: 'vikram@homedecor.com',
      priority: 'Cold',
      warrantyCheck: 'Yes',
      warrantyLastDate: '2025-12-31',
      billAttach: '',
      items: [
        {
          itemName: 'Jigsaw',
          modelName: 'GST 650',
          qty: '1',
          partNo: 'GST650',
        },
      ],
      receiverName: 'Neha Gupta',
    },
    {
      indentNumber: 'IN-004',
      enquiryType: 'Service',
      clientType: 'Existing',
      companyName: 'Industrial Motors Co',
      contactPersonName: 'Anil Kapoor',
      contactPersonNumber: '+91 7766554433',
      hoBillAddress: '321, Factory Lane, Pune, Maharashtra',
      location: 'Pune',
      gstNumber: '27AABCU9603R1ZP',
      clientEmailId: 'anil@industrialmotors.com',
      priority: 'Hot',
      warrantyCheck: 'Yes',
      warrantyLastDate: '2025-03-20',
      billAttach: '',
      items: [
        {
          itemName: 'Circular Saw',
          modelName: 'GKS 190',
          qty: '2',
          partNo: 'GKS190',
        },
        {
          itemName: 'Planer',
          modelName: 'GHO 26-82 D',
          qty: '1',
          partNo: 'GHO2682D',
        },
      ],
      receiverName: 'Ramesh Joshi',
    },
  ];

  const dummyChallans = [
    {
      indentNumber: 'IN-001',
      machineReceived: 'Yes',
      challanUpload: 'data:application/pdf;base64,JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0NvdW50IDEvS2lkc1szIDAgUl0+PgplbmRvYmoKMyAwIG9iago8PC9UeXBlL1BhZ2UvTWVkaWFCb3hbMCAwIDYxMiA3OTJdL1BhcmVudCAyIDAgUi9SZXNvdXJjZXM8PC9Gb250PDwvRjEgNCAwIFI+Pj4+L0NvbnRlbnRzIDUgMCBSPj4KZW5kb2JqCjQgMCBvYmoKPDwvVHlwZS9Gb250L1N1YnR5cGUvVHlwZTEvQmFzZUZvbnQvVGltZXMtUm9tYW4+PgplbmRvYmoKNSAwIG9iago8PC9MZW5ndGggNDQ+PgpzdHJlYW0KQlQKL0YxIDI0IFRmCjEwMCA3MDAgVGQKKFNhbXBsZSBDaGFsbGFuKSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAxMCAwMDAwMCBuIAowMDAwMDAwMDU5IDAwMDAwIG4gCjAwMDAwMDAxMTYgMDAwMDAgbiAKMDAwMDAwMDIzOCAwMDAwMCBuIAowMDAwMDAwMzE3IDAwMDAwIG4gCnRyYWlsZXIKPDwvU2l6ZSA2L1Jvb3QgMSAwIFI+PgpzdGFydHhyZWYKNDEwCiUlRU9G',
      completedDate: '2025-11-28',
    },
  ];

  localStorage.setItem('bosch_enquiries', JSON.stringify(dummyEnquiries));
  localStorage.setItem('bosch_challans', JSON.stringify(dummyChallans));
  localStorage.setItem('bosch_data_initialized', 'true');
}
