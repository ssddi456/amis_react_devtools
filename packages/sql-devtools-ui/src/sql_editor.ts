import tableSourceManager from './data/example';
import { copyToClipboard } from './tools/copy';
import { registerHivesqlLs } from '@amis-devtools/sql-language-service/src/register_ls';
import { LanguageIdEnum } from 'monaco-sql-languages';

const createSqlEditor = (name: string) => ({
    "type": "editor",
    "name": name,
    "label": "编辑器",
    "language": LanguageIdEnum.HIVE,
    allowFullscreen: true,
    "editorDidMount": registerHivesqlLs({
        tableSourceManager,
        onCopyToClipboard: (text) => {
            return copyToClipboard(text);
        }
    })
})

export default createSqlEditor;