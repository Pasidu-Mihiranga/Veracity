# LangGraph Suitability Matrix

Outcomes: **Remain Custom** | **Hybrid** | **LangGraph** | **Independent Service**

| Responsibility | Current | Benefits of LG | Disadvantages | Complexity | Accuracy | Perf | Maintenance | Risk | Final |
|----------------|---------|----------------|---------------|------------|----------|------|-------------|------|-------|
| Intent Router | Rules+LLM | Viz only | Loses tested hybrid | High | Negative risk | Neutral | Worse | High | **Remain Custom** |
| Tier Selection | Deterministic | None | Noise | Low | Neutral | Neutral | Worse | Low | **Remain Custom** |
| Mission Planner | Pure DAG TS | Could own edges | Dual definition | Low | Neutral | Neutral | Dual source | Med | **Remain Custom** (SoT); Hybrid mirrors |
| Agent Selection | Pure TS | None | — | Low | Neutral | Neutral | — | Low | **Remain Custom** |
| Parallel waves | Imperative loop | Clearer runtime; checkpoints | Dep + dual executor | Med | Neutral if parity | ≤5% risk | Better with iface | Med | **Hybrid** |
| Research agents | Custom `run()` | LC chains | Prompt/tool rewrite | High | **High negative** | Worse | Lock-in | Critical | **Remain Custom** |
| Execution Engine | Custom+grounding | Subgraph wrap | Drop grounding | Med | High if wrong | Neutral | — | High | **Remain Custom** |
| Tool retry | Firecrawl/Gemini | None | — | — | — | — | — | — | **Remain Custom** |
| Quality Gate | Pure TS | None | LLM-ization destroys honesty | — | **Critical** | — | — | Critical | **Remain Custom** |
| Evidence | Pure TS | None | False citations | — | **Critical** | — | — | Critical | **Remain Custom** |
| Memory / Decisions / KG | Platform | Scale later | Premature | High | Med | — | — | Med | **Custom** (service later) |
| Streaming | SSE/Inngest | None | — | — | — | — | — | — | **Remain Custom** |
| Reports / UI / Auth / FF / Workspace | Platform | None | — | — | — | — | — | — | **Remain Custom** |

## Rule

Never recommend LangGraph because it exists. Only the **wave executor** is a Hybrid candidate; everything accuracy-critical stays custom TypeScript libraries.
