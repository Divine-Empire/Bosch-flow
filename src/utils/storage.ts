import { Enquiry } from '../types';

const STORAGE_KEY = 'bosch_enquiries';

// No dummy data — all data is sourced from the GAS backend (Google Sheets).

export const storage = {
    getEnquiries: (): Enquiry[] => {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return [];
        try {
            const parsedData = JSON.parse(data);
            if (!Array.isArray(parsedData)) return [];
            return parsedData;
        } catch {
            return [];
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

    getNextEntryNumber: (): string => {
        const enquiries = storage.getEnquiries();
        if (enquiries.length === 0) return 'IN-001';
        const maxNum = enquiries.reduce((max, curr) => {
            const num = parseInt(curr.id.split('-')[1]);
            return num > max ? num : max;
        }, 0);
        return `IN-${String(maxNum + 1).padStart(3, '0')}`;
    }
};
