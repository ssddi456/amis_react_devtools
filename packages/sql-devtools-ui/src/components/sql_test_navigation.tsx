// This file has been moved to ./components/sql_test_navigation.tsx and is now removed from the demo directory.
import React, { useEffect } from 'react';
import { DoSqlTest } from "./do_sql_test";
import { LsTestCase } from '../tools/tests';

interface SqlTestNavigationProps {
    sqlTest: LsTestCase[];
    onChange: (index: number) => void;
}


const localStorageKey = 'amis_react_devtools_demo_settings';

interface AppSettings {
    caseIndex: number;
    showDebug: boolean;
}

const getStorageSettings = (): AppSettings => {
    try {
        const stored = localStorage.getItem(localStorageKey);
        if (stored) {
            const parsed = JSON.parse(stored);
            return {
                caseIndex: parsed.caseIndex || 0,
                showDebug: parsed.showDebug || false
            };
        }
    } catch (error) {
        console.warn('Failed to parse localStorage settings:', error);
    }
    return { caseIndex: 0, showDebug: false };
};

const saveStorageSettings = (settings: AppSettings) => {
    try {
        localStorage.setItem(localStorageKey, JSON.stringify(settings));
    } catch (error) {
        console.warn('Failed to save localStorage settings:', error);
    }
};

export const SqlTestNavigation: React.FC<SqlTestNavigationProps> = ({
    sqlTest,
    onChange,
}) => {
    const initialSettings = getStorageSettings();
    const [caseIndex, setCaseIndex] = React.useState(initialSettings.caseIndex);
    const [showDebug, setShowDebug] = React.useState(initialSettings.showDebug);

    const maxIndex = sqlTest.length - 1;
    const changeCase = (index: number) => {
        const newIndex = Math.max(0, Math.min(maxIndex, index));
        setCaseIndex(newIndex);
        onChange(newIndex);
        saveStorageSettings({ caseIndex: newIndex, showDebug });
    };

    const toggleShowDebug = (checked: boolean) => {
        setShowDebug(checked);
        saveStorageSettings({ caseIndex, showDebug: checked });
    };

    useEffect(() => {
        setTimeout(() => {
            onChange(caseIndex);
        });
    }, []);

    return (
        <div
            style={{ margin: '10px 0', height: '100vh', display: 'flex', flexDirection: 'column' }}
        >
            <h3 style={{ flex: 0 }}>All tests</h3>
            <div
                style={{ flex: 0 }}
            >
                <button
                    onClick={() => changeCase(caseIndex - 1)}
                    disabled={caseIndex <= 0}
                >
                    Previous
                </button>
                <span style={{ margin: '0 10px' }}>
                    Case {caseIndex + 1} of {maxIndex + 1}
                </span>
                <button
                    onClick={() => changeCase(caseIndex + 1)}
                    disabled={caseIndex >= maxIndex}
                >
                    Next
                </button>
                <label style={{ marginLeft: '20px' }}>
                    <input
                        type="checkbox"
                        checked={showDebug}
                        onChange={(e) => toggleShowDebug(e.target.checked)}
                    />
                    <span style={{ marginLeft: '5px' }}>Show Debug</span>
                </label>
                <a href='https://dtstack.github.io/monaco-sql-languages/' target='_blank' rel='noopener noreferrer'>
                    ast parser
                </a>
                <a href='https://raw.githubusercontent.com/DTStack/dt-sql-parser/refs/heads/main/src/grammar/hive/HiveSqlParser.g4' target='_blank' rel='noopener noreferrer' style={{ marginLeft: '10px' }}>
                    g4
                </a>
            </div>
            <div
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    backgroundColor: '#f5f5f5',
                }}
            >
                <DoSqlTest case={sqlTest[caseIndex]} key={caseIndex} showDebug={showDebug} />
            </div>
        </div>
    );
};
