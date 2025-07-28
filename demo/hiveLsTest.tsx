import { useState } from "react";
import { caseFromString, LsTestCase } from "./ls_helper";
import { createHiveLs } from "./sql_ls";

export const sqlTest = [
    // simple
    `
select * from data_test_news_record_di where pt = 1;
               ^
`,
    `
select * from data.data_test_news_record_di where data.pt = 1;
                ^   ^                               ^   ^
`,
    `
select * from data.data_test_news_record_di where data.pt = 1;
                  ^                                   ^  
`,
    // simple with alias
    // simple with alias
    `select
  field_2, t.test
    ^      ^ ^
from data_test_news_record_da t
      ^
where pt = 2;
      ^
`,

    `select
  t.field_2, t.test,
     ^
  count(*) as cnt
               ^
from data.data_test_news_record_da t
      ^    ^
where pt = 2
       ^
group by
  t.field_2, t.test
     ^       ^
;`,
    `select
  t1.house_code, t1.resblock_id, t2.quota_date
  ^   ^                           ^  ^
from data.data_test_news_record_di t1
     ^      ^
  left join data.data_test_quota_similar_house_region_da t2
              ^  ^                                       ^
  on t1.house_code = t2.house_code
      ^  ^           ^     ^
    and t1.resblock_id = t2.resblock_id
        ^  ^             ^     ^
where t1.pt = 2;
      ^
`,
    `
with t1 as (
  select
    house_code, resblock_id, resblock_name
  from data.data_test_news_record_di
        ^     ^
  where pt = 2
),
t2 as (
  select
    house_code, resblock_id, quota_date
  from data.data_test_quota_similar_house_region_da
)
select
  t1.house_code, t1.resblock_id, t2.quota_date
  ^   ^                           ^  ^
from t1
     ^
  left join t2
            ^
  on t1.house_code = t2.house_code
  and t1.resblock_id = t2.resblock_id
;
`,
    `
with t1 as (
  select
    t1.house_code, t1.resblock_id, t1.resblock_name, t2.quota_date
                                                      ^  ^
  from data.data_test_news_record_di t1
  left join (
        select
            house_code, resblock_id, quota_date
            ^
        from data.data_test_news_record_da
                ^    ^
  ) t2
  on t1.house_code = t2.house_code
                     ^     ^
  and t1.resblock_id = t2.resblock_id
  where t1.pt = 2
)
select
  t.house_code, t.resblock_id, t.quota_date
from t1 t
;
`
].map(x => caseFromString(x));

console.log('sql test cases', sqlTest);


export function DoSqlTest({ case: testCase }: { case: LsTestCase }) {
    const [results, _] = useState(() => {
        const model = testCase.model;
        const positions = testCase.positions;
        const hoverResults = positions.map(pos => {
            const resInfo = createHiveLs(model).doHover(pos);
            return resInfo;
        });
        return { model, positions, hoverResults };
    });
    return (
        <div
            style={{
                display: 'flex',
                gap: '10px',
                marginBottom: '8px',
                padding: 8,
                backgroundColor: '#f5f5f5',
            }}
        >
            <pre
                style={{
                    flex: 1,
                    maxWidth: 'calc(50% - 5px)',
                    wordWrap: 'break-word',
                    whiteSpace: 'pre-inline',
                }}
            >
                {testCase.model.getValue()}
            </pre>
            <div
                style={{
                    flex: 1,
                    maxWidth: 'calc(50% - 5px)'
                }}
            >
                {results.hoverResults.map((res, index) => {
                    const positionStr = `(${results.positions[index].lineNumber}:${results.positions[index].column})`;
                    if (res) {
                        const rangeStr = `(${res.range?.startLineNumber}:${res.range?.startColumn} -> ${res.range?.endLineNumber}:${res.range?.endColumn})`;
                        return (
                            <div key={index}>
                                <h4>Hover Result {index + 1}
                                    &nbsp;
                                    pos: {positionStr}
                                    &nbsp;
                                    range: {rangeStr}
                                </h4>
                                <pre
                                    style={{
                                        wordWrap: 'break-word',
                                        whiteSpace: 'pre-wrap',
                                    }}
                                >
                                    {res.contents.map(content => content.value).join('\n')}
                                </pre>
                            </div>
                        );
                    }
                    return (
                        <div key={index}>
                            <h4>Hover Result {index + 1} - No result</h4>
                            <p>Position: {positionStr}</p>
                        </div>
                    );
                })}
            </div>
        </div>);
}