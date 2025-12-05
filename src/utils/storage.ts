import { Enquiry } from '../types';

const STORAGE_KEY = 'bosch_enquiries';

const dummyData: Enquiry[] = [
    {
        id: 'IN-001',
        enquiryType: 'Service',
        clientType: 'Existing',
        companyName: 'ABC Corp',
        contactPersonName: 'John Doe',
        contactPersonNumber: '9876543210',
        hoBillAddress: '123 Main St, City',
        location: 'Mumbai',
        gstNumber: '27ABCDE1234F1Z5',
        clientEmailId: 'john@abc.com',
        priority: 'Hot',
        warrantyCheck: 'No',
        items: [
            { id: '1', itemName: 'Drill', modelName: 'D-100', qty: 2, partNo: 'P-123' }
        ],
        receiverName: 'Admin',
        createdAt: new Date().toISOString(),
        machineReceived: 'Yes',
        challanFile: 'dummy_challan.jpg',
        machineRepairStatus: 'Complete',
        currentPaymentStatus: 'Pending'
    },
    {
        id: 'IN-002',
        enquiryType: 'Both',
        clientType: 'New',
        companyName: 'XYZ Ltd',
        contactPersonName: 'Jane Smith',
        contactPersonNumber: '9123456780',
        hoBillAddress: '456 Park Ave, City',
        location: 'Delhi',
        gstNumber: '07XYZDE1234F1Z5',
        clientEmailId: 'jane@xyz.com',
        priority: 'Warm',
        warrantyCheck: 'Yes',
        warrantyLastDate: '2025-12-31',
        items: [
            { id: '1', itemName: 'Saw', modelName: 'S-200', qty: 1, partNo: 'P-456' }
        ],
        receiverName: 'User',
        createdAt: new Date().toISOString(),
        machineReceived: 'No'
    },
    {
        id: 'IN-003',
        enquiryType: 'Service',
        clientType: 'Existing',
        companyName: 'Tech Solutions',
        contactPersonName: 'Mike Johnson',
        contactPersonNumber: '9876541230',
        hoBillAddress: '789 Tech Park',
        location: 'Bangalore',
        gstNumber: '29ABCDE1234F1Z5',
        clientEmailId: 'mike@techsol.com',
        priority: 'Hot',
        warrantyCheck: 'No',
        items: [
            { id: '1', itemName: 'Grinder', modelName: 'G-300', qty: 5, partNo: 'P-789' }
        ],
        receiverName: 'Admin',
        createdAt: new Date().toISOString(),
        machineReceived: 'Yes',
        challanFile: 'challan_003.pdf',
        machineRepairStatus: 'Pending'
    },
    {
        id: 'IN-004',
        enquiryType: 'Sales',
        clientType: 'New',
        companyName: 'BuildIt Inc',
        contactPersonName: 'Sarah Connor',
        contactPersonNumber: '9988776655',
        hoBillAddress: '321 Builder Rd',
        location: 'Pune',
        gstNumber: '27XYZDE1234F1Z5',
        clientEmailId: 'sarah@buildit.com',
        priority: 'Cold',
        warrantyCheck: 'No',
        items: [
            { id: '1', itemName: 'Hammer', modelName: 'H-500', qty: 10, partNo: 'P-999' }
        ],
        receiverName: 'SalesTeam',
        createdAt: new Date().toISOString()
    },
    {
        id: 'IN-005',
        enquiryType: 'Service',
        clientType: 'Existing',
        companyName: 'FixIt Bros',
        contactPersonName: 'Bob Builder',
        contactPersonNumber: '8877665544',
        hoBillAddress: '555 Fix Lane',
        location: 'Chennai',
        gstNumber: '33ABCDE1234F1Z5',
        clientEmailId: 'bob@fixit.com',
        priority: 'Hot',
        warrantyCheck: 'Yes',
        warrantyLastDate: '2024-06-30',
        items: [
            { id: '1', itemName: 'Screwdriver', modelName: 'SD-X', qty: 20, partNo: 'P-000' }
        ],
        receiverName: 'Admin',
        createdAt: new Date().toISOString(),
        machineReceived: 'No',
        followUpStatus: 'Flw-Up',
        whatDidCustomerSay: 'Will send machine next week'
    }
];

export const storage = {
    getEnquiries: (): Enquiry[] => {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(dummyData));
            return dummyData;
        }
        try {
            const parsedData = JSON.parse(data);
            // Check if data is valid (has id)
            const isValid = Array.isArray(parsedData) && parsedData.length > 0 && parsedData.every((e: any) => e.id);

            if (!isValid) {
                console.warn('Invalid or old data found in localStorage. Resetting to dummy data.');
                localStorage.setItem(STORAGE_KEY, JSON.stringify(dummyData));
                return dummyData;
            }
            return parsedData;
        } catch (error) {
            console.error('Error parsing localStorage data:', error);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(dummyData));
            return dummyData;
        }
    },

    saveEnquiry: (enquiry: Enquiry) => {
        const enquiries = storage.getEnquiries();
        const newEnquiries = [enquiry, ...enquiries];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newEnquiries));
        return newEnquiries;
    },

    updateEnquiry: (id: string, updates: Partial<Enquiry>) => {
        const enquiries = storage.getEnquiries();
        const newEnquiries = enquiries.map(e =>
            e.id === id ? { ...e, ...updates } : e
        );
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newEnquiries));
        return newEnquiries;
    },

    deleteEnquiry: (id: string) => {
        const enquiries = storage.getEnquiries();
        const newEnquiries = enquiries.filter(e => e.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newEnquiries));
        return newEnquiries;
    },

    getNextIndentNumber: (): string => {
        const enquiries = storage.getEnquiries();
        if (enquiries.length === 0) return 'IN-001';

        // Extract numbers and find max
        const maxNum = enquiries.reduce((max, curr) => {
            const num = parseInt(curr.id.split('-')[1]);
            return num > max ? num : max;
        }, 0);

        return `IN-${String(maxNum + 1).padStart(3, '0')}`;
    }
};
