import React, { createContext, useContext, ReactNode } from 'react';
import { ContextManager } from '@amis-devtools/sql-language-service/src/context_manager';

interface ContextManagerContextType {
    contextManager: ContextManager | null;
}

const ContextManagerContext = createContext<ContextManagerContextType | undefined>(undefined);

interface ContextManagerProviderProps {
    contextManager: ContextManager | null;
    children: ReactNode;
}

export const ContextManagerProvider: React.FC<ContextManagerProviderProps> = ({
    contextManager,
    children,
}) => {
    return (
        <ContextManagerContext.Provider value={{ contextManager }}>
            {children}
        </ContextManagerContext.Provider>
    );
};

export const useContextManager = (): ContextManagerContextType => {
    const context = useContext(ContextManagerContext);
    if (context === undefined) {
        throw new Error('useContextManager must be used within a ContextManagerProvider');
    }
    return context;
};
