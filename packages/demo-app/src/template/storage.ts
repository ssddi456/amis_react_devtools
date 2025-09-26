export function createStorage<T>(key: string, load: (s: string) => T, defaultValue: T) {

    const loadFromStorage = (): T => {
        try {
            const stored = localStorage.getItem(key);
            if (stored) {
                return load(stored);
            }
        } catch (err) {
            console.error('Failed to load from storage:', err);
        }
        return defaultValue;
    }

    const saveToStorage = (data: string) => {
        try {
            localStorage.setItem(key, data);
        } catch (err) {
            console.error('Failed to save to storage:', err);
        }
    }

    return {
        load: loadFromStorage,
        save: saveToStorage
    }
}