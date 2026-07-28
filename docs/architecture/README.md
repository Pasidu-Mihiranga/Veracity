# Veracity AI — Architecture Pack (LangGraph Hybrid Review)

**Branch:** `feature/langgraph-hybrid-architecture`  
**Review version:** 2  
**Recommendation:** Option C — Small Hybrid (evidence-gated)  
**Status:** Documentation + Phase 0 implementation in progress. LangGraph dependency is **not** introduced until Phase 0 exit criteria and later benchmark gates pass.

## Deliverables

| # | Document | Path |
|---|----------|------|
| 1 | Current architecture | [current-architecture.md](./current-architecture.md) |
| 2 | AI workflow | [ai-workflow.md](./ai-workflow.md) |
| 3 | Business platform | [business-platform.md](./business-platform.md) |
| 4 | Code quality assessment | [code-quality-assessment.md](./code-quality-assessment.md) |
| 5 | LangGraph suitability matrix | [langgraph-suitability-matrix.md](./langgraph-suitability-matrix.md) |
| 6 | Workflow boundary analysis | [workflow-boundary-analysis.md](./workflow-boundary-analysis.md) |
| 7 | Hybrid architecture design | [hybrid-architecture-design.md](./hybrid-architecture-design.md) |
| 8 | WorkflowExecutor interface | [workflow-executor-interface.md](./workflow-executor-interface.md) |
| 9 | Migration roadmap | [migration-roadmap.md](./migration-roadmap.md) |
| 10 | Benchmark plan | [benchmark-plan.md](./benchmark-plan.md) |
| 11 | Success metrics | [success-metrics.md](./success-metrics.md) |
| 12 | Testing strategy | [testing-strategy.md](./testing-strategy.md) |
| 13 | Risk assessment | [risk-assessment.md](./risk-assessment.md) |
| 14 | ADRs | [../adr/0002-custom-first-orchestration.md](../adr/0002-custom-first-orchestration.md) … [0007](../adr/0007-benchmark-gate-before-langgraph-default.md) |
| 15 | Final recommendation | [final-recommendation.md](./final-recommendation.md) |

## Binding principles

- Improve before replacing; accuracy over architectural purity.
- LangGraph is an optional `WorkflowExecutor` implementation detail — not the product architecture.
- Never enable LangGraph by default without passing the ≥100-query benchmark gates.
