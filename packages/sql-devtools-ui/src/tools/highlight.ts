// 生成关键字高亮信息
interface KeywordHighlight {
    start: number;
    end: number;
    keyword: string;
    type: string;
}

// 生成关键字高亮信息列表
export function generateKeywordHighlights(sql: string, keywords: { match: string, type: string}[]): KeywordHighlight[] {
    const highlights: KeywordHighlight[] = [];
    const lowerSql = sql.toLowerCase();
    const lowerKeywords = keywords.map(k => ({...k, match: k.match.toLowerCase()}));

    lowerKeywords.forEach(({match, type }) => {
        let startIndex = 0;
        while (startIndex < lowerSql.length) {
            const index = lowerSql.indexOf(match, startIndex);
            if (index === -1) {
                break;
            }
            // 确保匹配的是完整的单词
            const beforeChar = index > 0 ? lowerSql[index - 1] : ' ';
            const afterChar = index + match.length < lowerSql.length ? lowerSql[index + match.length] : ' ';
            if (!/\w/.test(beforeChar) && !/\w/.test(afterChar)) {
                highlights.push({
                    start: index,
                    end: index + match.length,
                    keyword: sql.slice(index, index + match.length),
                    type,
                });
            }
            startIndex = index + match.length;
        }
    });

    highlights.sort((a, b) => a.start - b.start);

    return highlights;
}