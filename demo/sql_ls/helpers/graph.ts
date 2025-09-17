import { AtomSelectStatementContext, SelectStatementContext } from "dt-sql-parser/dist/lib/hive/HiveSqlParser";
import type { ContextManager } from "../context_manager";

export function mrScopeGraphOptimize(contextManager: ContextManager, rootId: string) {
    const mrScopeGraph = contextManager.mrScopeGraph;
    let graphRoot = mrScopeGraph.get(rootId);
    if (!graphRoot) {
        debugger;
        return;
    }
    const toVisit = [rootId];
    console.log('mrScopeGraphOptimize start', mrScopeGraph.keys());
    while (toVisit.length) {
        const id = toVisit.pop()!;
        const node = mrScopeGraph.get(id);
        if (!node) {
            continue;
        }
        const mrScope = contextManager.getMrScopeById(id);
        if (!mrScope) {
            toVisit.push(...node.deps);
            continue;
        }

        if (mrScope.context instanceof AtomSelectStatementContext) {
            toVisit.push(...node.deps);
            continue;
        }

        // do simplification
        const deps = node.deps;
        if (deps.length === 1) {
            const depedScope = contextManager.getMrScopeById(deps[0]);
            if (depedScope && (
                depedScope.context instanceof AtomSelectStatementContext
                || depedScope.context instanceof SelectStatementContext
            )) {
                const depedNode = mrScopeGraph.get(depedScope.id);
                if (depedNode) {
                    node.deps = depedNode.deps;
                    // atom select statement only pass through columns, can be simplified
                    mrScopeGraph.set(id, {
                        ...node,
                    });
                    mrScopeGraph.delete(deps[0]);
                }
            }
        }
        toVisit.push(...node.deps);
    }
    console.log('mrScopeGraphOptimize end', mrScopeGraph.keys());
}
