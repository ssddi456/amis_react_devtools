import { RenderOptions } from 'amis';


export function makeEnv(env?: Partial<RenderOptions>): RenderOptions {
    return {
        session: 'test-case',
        isCancel: () => false,
        notify: (msg: string) => null,
        jumpTo: (to: string) => console.info('Now should jump to ' + to),
        alert: msg => console.info(`Alert: ${msg}`),
        ...env
    };
}

export const createMockMediaMatcher =
    (matchesOrMapOfMatches: any) => (qs: any) => ({
        matches:
            typeof matchesOrMapOfMatches === 'object'
                ? matchesOrMapOfMatches[qs]
                : matchesOrMapOfMatches,
        media: '',
        addListener: () => { },
        addEventListener: () => { },
        removeEventListener: () => { },
        onchange: () => { },
        removeListener: () => { },
        dispatchEvent: () => {
            return true;
        }
    });

export function formatStyleObject(style: string | null, px2number = true) {
    if (!style) {
        return {};
    }

    // 去除注释 /* xx */
    style = style.replace(/\/\*[^(\*\/)]*\*\//g, '');

    const res: any = {};
    style.split(';').forEach((item: string) => {
        if (!item || !String(item).includes(':')) return;

        const [key, value] = item.split(':');

        res[String(key).trim()] =
            px2number && value.endsWith('px')
                ? Number(String(value).replace(/px$/, ''))
                : String(value).trim();
    });

    return res;
}

/**
 * This function searches for the every react-aria SSR ids in a given HTMLElement node and replace every attribute values with a static id
 *
 * This can be usefull when you're trying to generate a snapshot of components using react-aria under the hood
 *
 * @ex :
 * ```
 * const { container } = render(<Component />);
 *
 * replaceReactAriaIds(container);
 * ```
 *
 * @param container The HTMLElement node to search for SSR ids
 */
export function replaceReactAriaIds(container: HTMLElement) {
    const selectors = ['aria-labelledby'];
    const ariaSelector = (el: string) => `[${el}]`;
    const regexp = /downshift\-\d+-label/g;

    container
        .querySelectorAll(selectors.map(ariaSelector).join(', '))
        .forEach(el => {
            selectors.forEach(selector => {
                const attr = el.getAttribute(selector);

                if (attr?.match(regexp)) {
                    el.removeAttribute(selector);
                }
            });
        });

    container.querySelectorAll('[data-id]').forEach(el => {
        const val = el.getAttribute('data-id');
        if (typeof val === 'string' && /^[a-z0-9]{12}$/.test(val)) {
            el.removeAttribute('data-id');
        }
    });
}

