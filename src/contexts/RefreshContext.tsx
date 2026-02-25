import { createContext, useCallback, useContext, useState } from 'react';

interface RefreshContextValue {
    refreshCount: number;
    triggerRefresh: () => void;
}

const RefreshContext = createContext<RefreshContextValue>({
    refreshCount: 0,
    triggerRefresh: () => { },
});

export function RefreshProvider({ children }: { children: React.ReactNode }) {
    const [refreshCount, setRefreshCount] = useState(0);

    const triggerRefresh = useCallback(() => {
        setRefreshCount(c => c + 1);
    }, []);

    return (
        <RefreshContext.Provider value={{ refreshCount, triggerRefresh }}>
            {children}
        </RefreshContext.Provider>
    );
}

export function useRefresh() {
    return useContext(RefreshContext);
}
