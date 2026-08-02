"""
MiroFish Gemini Swarm Service
==============================
A lightweight Flask microservice that mirrors the MiroFish REST API contract
but uses Gemini to power the persona simulation layer instead of camel-ai/OASIS.

This is the production-ready path for the competition:
- Same API endpoints as the real MiroFish backend
- No PyTorch, no camel-ai, no heavyweight ML deps
- Each simulation stores its personas as JSON in ./data/<sim_id>/
- Interview calls have Gemini role-play as the configured swarm of personas
- Results are structurally identical — the TS client is unchanged

Endpoints implemented:
  GET  /api/graph/project/list
  POST /api/graph/build               (accepts multipart/form-data seed file)
  GET  /api/graph/task/<task_id>
  POST /api/simulation/create
  POST /api/simulation/prepare
  POST /api/simulation/prepare/status
  POST /api/simulation/start
  GET  /api/simulation/<sim_id>/run-status
  POST /api/simulation/interview/all  ← the hot path used at query time
  POST /api/simulation/env-status
"""

import os
import json
import uuid
import threading
import time
import re
import hmac
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI
from dotenv import load_dotenv

# ── Config ────────────────────────────────────────────────────────────────────
# Load env from service dir first, then parent Veracity/.env (shared Gemini key).
_SERVICE_DIR = Path(__file__).resolve().parent
load_dotenv(_SERVICE_DIR / ".env")
load_dotenv(_SERVICE_DIR.parent / ".env", override=False)

GEMINI_API_KEY  = os.getenv("LLM_API_KEY") or os.getenv("GEMINI_API_KEY") or ""
GEMINI_BASE_URL = os.getenv("LLM_BASE_URL",
                             "https://generativelanguage.googleapis.com/v1beta/openai/")
GEMINI_MODEL    = os.getenv("LLM_MODEL_NAME") or os.getenv("GEMINI_MODEL") or "gemini-flash-latest"
DATA_DIR        = Path(os.getenv("DATA_DIR", str(_SERVICE_DIR / "data")))
DATA_DIR.mkdir(parents=True, exist_ok=True)
if not GEMINI_API_KEY:
    print("[MiroFish] WARNING: GEMINI_API_KEY / LLM_API_KEY not set — interview/prepare will fail")

# Use OpenAI-compat client pointing at Gemini
ai = OpenAI(api_key=GEMINI_API_KEY, base_url=GEMINI_BASE_URL)

app = Flask(__name__)

# ── Access control ────────────────────────────────────────────────────────────
# This service holds a model API key and does unbounded model work on request.
# Left open it is a quota-drain and a cross-tenant read waiting to happen, so it
# is treated as a private worker rather than a public API:
#
#   - CORS is restricted to the app origin instead of every origin.
#   - Every route except /health requires a shared secret.
#   - The listen address defaults to loopback (see the __main__ block).
#
# MIROFISH_ALLOWED_ORIGIN and MIROFISH_SERVICE_TOKEN are set by whatever starts
# both processes. With no token configured the service refuses to serve anything
# rather than falling open, because a silent open default is how this ends up
# exposed in the one environment nobody checked.
ALLOWED_ORIGIN   = os.getenv("MIROFISH_ALLOWED_ORIGIN", "http://localhost:3000")
SERVICE_TOKEN    = os.getenv("MIROFISH_SERVICE_TOKEN", "")

CORS(app, origins=[ALLOWED_ORIGIN], supports_credentials=False)

if not SERVICE_TOKEN:
    print("[MiroFish] WARNING: MIROFISH_SERVICE_TOKEN is not set — all API routes will return 503")


@app.before_request
def _require_service_token():
    """Reject anything without the shared secret, except health checks."""
    if request.path in ("/health", "/api/health"):
        return None
    if request.method == "OPTIONS":
        return None

    if not SERVICE_TOKEN:
        return jsonify({
            "success": False,
            "error": "service is not configured with MIROFISH_SERVICE_TOKEN",
        }), 503

    presented = request.headers.get("X-MiroFish-Token", "")
    # Constant-time compare: a plain == leaks the token a byte at a time to
    # anyone willing to measure.
    if not hmac.compare_digest(presented, SERVICE_TOKEN):
        return jsonify({"success": False, "error": "unauthorized"}), 401

    return None

# ── In-memory task registry ───────────────────────────────────────────────────
# { task_id: { status, result, error } }
TASKS: dict[str, dict] = {}
TASKS_LOCK = threading.Lock()


def new_task_id() -> str:
    return f"task_{uuid.uuid4().hex[:12]}"

def new_sim_id() -> str:
    return f"sim_{uuid.uuid4().hex[:12]}"

def new_project_id() -> str:
    return f"proj_{uuid.uuid4().hex[:12]}"

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

# Identifiers are generated server-side as "sim_<hex>" / "proj_<hex>", so a
# well-formed id can only ever be alphanumerics, underscore, and hyphen.
# Anything else arrived from a caller who is trying to escape the data
# directory.
_SAFE_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def _safe_subdir(root: Path, identifier: str, kind: str) -> Path:
    """Resolve `root/identifier`, refusing anything that escapes `root`.

    The character check alone would be enough today, but the resolve-and-compare
    is what keeps this correct if the id format is ever relaxed — and on a
    filesystem with symlinks, only the resolved comparison is authoritative.
    """
    if not _SAFE_ID.match(identifier or ""):
        raise ValueError(f"invalid {kind}")

    base = root.resolve()
    candidate = (base / identifier).resolve()

    if candidate != base and base not in candidate.parents:
        raise ValueError(f"invalid {kind}")

    candidate.mkdir(parents=True, exist_ok=True)
    return candidate


def sim_dir(simulation_id: str) -> Path:
    return _safe_subdir(DATA_DIR / "simulations", simulation_id, "simulation_id")

def proj_dir(project_id: str) -> Path:
    return _safe_subdir(DATA_DIR / "projects", project_id, "project_id")

def load_json(path: Path) -> dict:
    if path.exists():
        with open(path) as f:
            return json.load(f)
    return {}

def save_json(path: Path, data: dict):
    with open(path, "w") as f:
        json.dump(data, f, indent=2)

def gemini(prompt: str, json_mode: bool = False) -> str:
    """Single Gemini call via OpenAI-compat endpoint."""
    kwargs: dict = dict(
        model=GEMINI_MODEL,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=4096,
    )
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    resp = ai.chat.completions.create(**kwargs)
    return resp.choices[0].message.content or ""

def strip_code_fences(text: str) -> str:
    text = re.sub(r"^```(?:json)?\s*", "", text.strip())
    text = re.sub(r"\s*```$", "", text)
    return text.strip()

# ── Persona generation ────────────────────────────────────────────────────────

def generate_personas(seed_text: str, product: str, num_personas: int = 20) -> list[dict]:
    """
    Given seed material about a product/market, generate a diverse swarm of
    simulated market personas.  Each persona has a background, beliefs, and
    prior context derived from the seed text.
    """
    prompt = f"""You are building a swarm simulation of market personas for competitive intelligence.

Product / market context:
\"\"\"
{seed_text[:4000]}
\"\"\"

Generate {num_personas} highly diverse, realistic market personas who would be relevant to
analysing this product and market.  Include a mix of:
- End users (power users, casual users, churned users)
- Buyers / decision-makers (CTO, VP Sales, Procurement, CFO)
- Competitors' customers
- Industry analysts / investors
- Developers / technical evaluators
- Sceptics and enthusiastic advocates

For each persona output a JSON object with:
{{
  "id": <integer 0-based>,
  "name": "<first name + last name>",
  "role": "<job title>",
  "company_type": "<startup / enterprise / mid-market / investor / analyst / individual>",
  "background": "<2-3 sentence background>",
  "stance": "<positive / neutral / negative / sceptical>",
  "platform_preference": "<twitter or reddit>"
}}

Reply with ONLY a JSON array of {num_personas} persona objects.  No markdown, no explanation."""

    try:
        raw = gemini(prompt)
        personas = json.loads(strip_code_fences(raw))
        if isinstance(personas, list) and personas:
            return personas[:num_personas]
    except Exception as e:
        raise RuntimeError(f"Persona generation failed; no scenario was prepared: {e}") from e

    raise RuntimeError("Persona generation returned no valid personas; no scenario was prepared")


# ── Graph / project endpoints ─────────────────────────────────────────────────

@app.route("/api/graph/project/list", methods=["GET"])
def list_projects():
    projects_root = DATA_DIR / "projects"
    projects_root.mkdir(parents=True, exist_ok=True)
    result = []
    for p in projects_root.iterdir():
        meta_path = p / "meta.json"
        if meta_path.exists():
            result.append(load_json(meta_path))
    return jsonify({"success": True, "data": result, "count": len(result)})


@app.route("/api/graph/build", methods=["POST"])
def build_graph():
    """
    Accept a seed file upload.  Immediately extract text from the file,
    generate personas in a background thread, and return a task_id to poll.
    """
    project_id = request.form.get("project_id") or new_project_id()
    file = request.files.get("file")

    seed_text = ""
    if file:
        raw = file.read()
        # Try to decode as text; fall back to PyMuPDF for PDF
        try:
            seed_text = raw.decode("utf-8", errors="replace")
        except Exception:
            seed_text = raw.decode("latin-1", errors="replace")

    if not seed_text.strip():
        seed_text = f"Market intelligence seed for project {project_id}."

    task_id = new_task_id()
    graph_id = f"graph_{uuid.uuid4().hex[:12]}"

    # Save project meta
    p_dir = proj_dir(project_id)
    save_json(p_dir / "meta.json", {
        "project_id": project_id,
        "graph_id": graph_id,
        "status": "building",
        "created_at": now_iso(),
    })
    save_json(p_dir / "seed.json", {"text": seed_text})

    with TASKS_LOCK:
        TASKS[task_id] = {"status": "running", "result": None, "error": None}

    # Background: extract a product name + generate ontology summary
    def build_worker():
        try:
            # Extract product name from seed
            product_name = "the product"
            try:
                extract_prompt = f"""From this text, extract the primary product or company name being described.
Reply with ONLY the product/company name, nothing else.

Text: {seed_text[:500]}"""
                product_name = gemini(extract_prompt).strip().strip('"').strip("'")
            except Exception:
                pass

            # Build ontology summary (fall back if Gemini quota is exhausted)
            ontology = {
                "product": product_name,
                "market": "technology",
                "entities": [],
                "competitors": [],
                "key_themes": [],
            }
            try:
                ontology_prompt = f"""You are building a knowledge graph ontology for a market simulation.

Seed material about {product_name}:
\"\"\"
{seed_text[:3000]}
\"\"\"

Extract a structured ontology with:
- Main entities (product, company, competitors, market segments)
- Key relationships
- Market context

Reply with JSON:
{{
  "product": "<name>",
  "market": "<1-line description>",
  "entities": ["entity1", "entity2", ...],
  "competitors": ["comp1", "comp2", ...],
  "key_themes": ["theme1", "theme2", ...]
}}"""
                ontology_raw = gemini(ontology_prompt, json_mode=True)
                try:
                    parsed = json.loads(strip_code_fences(ontology_raw))
                    if isinstance(parsed, dict):
                        ontology = parsed
                except Exception:
                    pass
            except Exception as e:
                print(f"[MiroFish] ontology Gemini failed, using seed fallback: {e}")
                # crude product guess from first line of seed
                first = (seed_text.strip().splitlines() or ["the product"])[0].strip()
                if first and product_name == "the product":
                    product_name = first[:80]
                    ontology["product"] = product_name

            # Save ontology + update project
            save_json(p_dir / "ontology.json", ontology)
            meta = load_json(p_dir / "meta.json")
            meta["status"] = "completed"
            meta["product_name"] = ontology.get("product", product_name)
            meta["updated_at"] = now_iso()
            save_json(p_dir / "meta.json", meta)

            with TASKS_LOCK:
                TASKS[task_id] = {
                    "status": "completed",
                    "result": {"graph_id": graph_id, "project_id": project_id, "ontology": ontology},
                    "error": None,
                }
        except Exception as e:
            with TASKS_LOCK:
                TASKS[task_id] = {"status": "failed", "result": None, "error": str(e)}
            meta = load_json(p_dir / "meta.json")
            meta["status"] = "failed"
            meta["error"] = str(e)
            save_json(p_dir / "meta.json", meta)

    threading.Thread(target=build_worker, daemon=True).start()

    return jsonify({
        "success": True,
        "data": {"task_id": task_id, "graph_id": graph_id, "project_id": project_id},
    })


@app.route("/api/graph/task/<task_id>", methods=["GET"])
def get_task(task_id: str):
    with TASKS_LOCK:
        task = TASKS.get(task_id, {"status": "not_found", "result": None, "error": None})
    result = task.get("result") or {}
    return jsonify({
        "success": True,
        "data": {
            "task_id": task_id,
            "status": task["status"],
            "graph_id": result.get("graph_id"),
            "project_id": result.get("project_id"),
            "result": result,
            "error": task.get("error"),
        },
    })


# ── Simulation lifecycle endpoints ────────────────────────────────────────────

@app.route("/api/simulation/create", methods=["POST"])
def create_simulation():
    data = request.get_json() or {}
    project_id = data.get("project_id", "")
    graph_id   = data.get("graph_id", "")

    if not project_id:
        return jsonify({"success": False, "error": "project_id required"}), 400

    simulation_id = new_sim_id()
    s_dir = sim_dir(simulation_id)

    # Link project data
    p_meta = load_json(proj_dir(project_id) / "meta.json") if project_id else {}
    ontology = load_json(proj_dir(project_id) / "ontology.json") if project_id else {}
    seed_data = load_json(proj_dir(project_id) / "seed.json") if project_id else {}

    save_json(s_dir / "meta.json", {
        "simulation_id": simulation_id,
        "project_id": project_id,
        "graph_id": graph_id,
        "status": "created",
        "product_name": p_meta.get("product_name", project_id),
        "ontology": ontology,
        "seed_text": seed_data.get("text", ""),
        "created_at": now_iso(),
    })

    return jsonify({"success": True, "data": {"simulation_id": simulation_id}})


@app.route("/api/simulation/prepare", methods=["POST"])
def prepare_simulation():
    """
    Generate the full persona swarm for this simulation.
    Returns a task_id to poll.  Fast (< 30s for 20 personas).
    """
    data = request.get_json() or {}
    simulation_id = data.get("simulation_id", "")

    if not simulation_id:
        return jsonify({"success": False, "error": "simulation_id required"}), 400

    task_id = new_task_id()
    s_dir = sim_dir(simulation_id)
    meta = load_json(s_dir / "meta.json")

    with TASKS_LOCK:
        TASKS[task_id] = {"status": "running", "result": None, "error": None}

    def prepare_worker():
        try:
            seed_text    = meta.get("seed_text", "") or meta.get("product_name", simulation_id)
            product_name = meta.get("product_name", "the product")
            personas = generate_personas(seed_text, product_name, num_personas=20)

            save_json(s_dir / "personas.json", {"personas": personas, "generated_at": now_iso()})

            meta["status"] = "prepared"
            meta["persona_count"] = len(personas)
            meta["updated_at"] = now_iso()
            save_json(s_dir / "meta.json", meta)

            with TASKS_LOCK:
                TASKS[task_id] = {
                    "status": "completed",
                    "result": {"simulation_id": simulation_id, "persona_count": len(personas)},
                    "error": None,
                }
        except Exception as e:
            with TASKS_LOCK:
                TASKS[task_id] = {"status": "failed", "result": None, "error": str(e)}
            meta["status"] = "prepare_failed"
            meta["error"] = str(e)
            save_json(s_dir / "meta.json", meta)

    threading.Thread(target=prepare_worker, daemon=True).start()

    return jsonify({"success": True, "data": {"task_id": task_id, "simulation_id": simulation_id}})


@app.route("/api/simulation/prepare/status", methods=["POST"])
def prepare_status():
    data = request.get_json() or {}
    task_id = data.get("task_id", "")
    with TASKS_LOCK:
        task = TASKS.get(task_id, {"status": "not_found", "result": None, "error": None})
    return jsonify({"success": True, "data": {"task_id": task_id, "status": task["status"], "error": task.get("error")}})


@app.route("/api/simulation/start", methods=["POST"])
def start_simulation():
    data = request.get_json() or {}
    simulation_id = data.get("simulation_id", "")

    if not simulation_id:
        return jsonify({"success": False, "error": "simulation_id required"}), 400

    s_dir = sim_dir(simulation_id)
    meta = load_json(s_dir / "meta.json")
    meta["status"] = "waiting_command"
    meta["started_at"] = now_iso()
    meta["updated_at"] = now_iso()
    save_json(s_dir / "meta.json", meta)

    return jsonify({"success": True, "data": {"simulation_id": simulation_id, "status": "waiting_command"}})


@app.route("/api/simulation/<simulation_id>/run-status", methods=["GET"])
def run_status(simulation_id: str):
    s_dir = sim_dir(simulation_id)
    meta = load_json(s_dir / "meta.json")
    status = meta.get("status", "idle")

    return jsonify({
        "success": True,
        "data": {
            "simulation_id": simulation_id,
            "runner_status": status,
            "status": status,
            "current_round": 1,
            "total_rounds": 1,
            "progress_percent": 100 if status == "waiting_command" else 0,
            "persona_count": meta.get("persona_count", 0),
            "started_at": meta.get("started_at"),
            "updated_at": meta.get("updated_at"),
        },
    })


@app.route("/api/simulation/<simulation_id>/config", methods=["GET"])
def simulation_config(simulation_id: str):
    """Compat endpoint for Veracity live/per-agent clients."""
    s_dir_path = sim_dir(simulation_id)
    meta = load_json(s_dir_path / "meta.json")
    if not meta:
        return jsonify({"success": False, "error": f"Simulation {simulation_id} not found"}), 404
    personas = load_json(s_dir_path / "personas.json").get("personas", [])
    agent_configs = [
        {"agent_id": int(p.get("id", i)), "name": p.get("name"), "role": p.get("role")}
        for i, p in enumerate(personas)
    ]
    return jsonify({
        "success": True,
        "data": {
            "simulation_id": simulation_id,
            "product_name": meta.get("product_name"),
            "persona_count": len(agent_configs),
            "agent_configs": agent_configs,
        },
    })


@app.route("/api/simulation/interview", methods=["POST"])
def interview_one():
    """Single-agent interview (compat with Veracity live client)."""
    data = request.get_json() or {}
    simulation_id = data.get("simulation_id", "")
    agent_id = data.get("agent_id")
    prompt = data.get("prompt", "")
    if not simulation_id or agent_id is None or not prompt:
        return jsonify({"success": False, "error": "simulation_id, agent_id, and prompt required"}), 400

    s_dir_path = sim_dir(simulation_id)
    meta = load_json(s_dir_path / "meta.json")
    personas = load_json(s_dir_path / "personas.json").get("personas", [])
    persona = next((p for p in personas if int(p.get("id", -1)) == int(agent_id)), None)
    if not persona:
        return jsonify({"success": False, "error": f"agent_id {agent_id} not found"}), 404

    product_name = meta.get("product_name", "the product")
    batch_prompt = f"""You are {persona.get('name','Persona')} — {persona.get('role','professional')}.
Background: {persona.get('background','')}
Stance: {persona.get('stance','neutral')}
Product context: {product_name}

Answer in first person (2-4 sentences) to:
"{prompt}"
"""
    try:
        response_text = gemini(batch_prompt).strip()
    except Exception as exc:
        return jsonify({
            "success": False,
            "error": f"Interview failed for agent {agent_id}: {exc}",
        }), 502

    if not response_text:
        return jsonify({
            "success": False,
            "error": f"Interview returned an empty response for agent {agent_id}",
        }), 502

    return jsonify({
        "success": True,
        "data": {
            "agent_id": int(agent_id),
            "response": response_text,
            "result": response_text,
            "platform": persona.get("platform_preference", "reddit"),
        },
    })


@app.route("/api/simulation/env-status", methods=["POST"])
def env_status():
    data = request.get_json() or {}
    simulation_id = data.get("simulation_id", "")
    s_dir = sim_dir(simulation_id)
    meta = load_json(s_dir / "meta.json")
    alive = meta.get("status") in ("waiting_command", "completed", "running")
    return jsonify({"success": True, "data": {"simulation_id": simulation_id, "env_alive": alive}})


# ── Interview all — the hot production path ───────────────────────────────────

@app.route("/api/simulation/interview/all", methods=["POST"])
def interview_all():
    """
    Poll the full persona swarm with a question.
    Each persona responds in their voice using Gemini with their background as context.
    Uses batched Gemini calls (5 personas per call) to stay fast.
    """
    data = request.get_json() or {}
    simulation_id = data.get("simulation_id", "")
    prompt        = data.get("prompt", "")
    platform      = data.get("platform")           # twitter / reddit / None
    timeout_sec   = int(data.get("timeout", 180))

    if not simulation_id:
        return jsonify({"success": False, "error": "simulation_id required"}), 400
    if not prompt:
        return jsonify({"success": False, "error": "prompt required"}), 400

    s_dir_path = sim_dir(simulation_id)
    meta = load_json(s_dir_path / "meta.json")

    if not meta:
        return jsonify({"success": False, "error": f"Simulation {simulation_id} not found"}), 404

    # Load personas
    personas_data = load_json(s_dir_path / "personas.json")
    personas: list[dict] = personas_data.get("personas", [])

    if not personas:
        return jsonify({"success": False, "error": "Simulation not prepared. Call /prepare first."}), 400

    # Filter by platform preference if requested
    if platform in ("twitter", "reddit"):
        personas = [p for p in personas if p.get("platform_preference") == platform] or personas

    product_name = meta.get("product_name", "the product")
    ontology     = meta.get("ontology", {})
    market_ctx   = ontology.get("market", "") if ontology else ""

    # Batched interview: 5 personas per Gemini call for speed + quality
    BATCH = 5
    all_results: dict[str, dict] = {}
    failures: list[dict] = []
    deadline = time.time() + timeout_sec

    persona_batches = [personas[i:i+BATCH] for i in range(0, len(personas), BATCH)]

    for batch in persona_batches:
        if time.time() > deadline:
            break

        persona_descriptions = "\n".join([
            f"[{p['id']}] {p.get('name','?')} — {p.get('role','?')} ({p.get('company_type','?')}). "
            f"Background: {p.get('background','')} Stance: {p.get('stance','neutral')}."
            for p in batch
        ])

        batch_prompt = f"""You are simulating a swarm of market personas evaluating {product_name}.
{f'Market context: {market_ctx}' if market_ctx else ''}

The following personas are being asked:
"{prompt}"

Personas:
{persona_descriptions}

For EACH persona (in ID order), write their authentic response in first person, reflecting their role, background, and stance.
Each response should:
- Be 2-4 sentences
- Include a probabilistic estimate where relevant (e.g. "I'd put this at ~70%")  
- Reference their specific professional context
- Be distinctly different from other personas

Reply with ONLY a JSON object (no markdown) mapping persona ID to response string:
{{"0": "response...", "1": "response...", ...}}"""

        try:
            raw = gemini(batch_prompt, json_mode=True)
            batch_responses = json.loads(strip_code_fences(raw))
        except Exception as exc:
            for p in batch:
                failures.append({"agent_id": p.get("id"), "error": str(exc)})
            continue

        for p in batch:
            pid = p["id"]
            response_text = str(batch_responses.get(str(pid), "")).strip()
            if not response_text:
                failures.append({"agent_id": pid, "error": "empty persona response"})
                continue
            plat = p.get("platform_preference", "twitter")
            key = f"{plat}_{pid}"
            all_results[key] = {
                "agent_id": pid,
                "response": response_text,
                "platform": plat,
                "persona": p.get("name", f"Persona {pid}"),
                "role": p.get("role", ""),
                "stance": p.get("stance", "neutral"),
                "timestamp": now_iso(),
            }

    if not all_results:
        return jsonify({
            "success": False,
            "error": "All persona interviews failed; no synthetic fallback was generated",
            "data": {"failures": failures},
        }), 502

    # Save the complete interview so later scenario turns can be reconstructed.
    history_path = s_dir_path / "interview_history.json"
    history = []
    if history_path.exists():
        try:
            history = json.loads(history_path.read_text())
        except Exception:
            history = []
    history.append({
        "prompt": prompt,
        "timestamp": now_iso(),
        "responses_count": len(all_results),
        "responses": all_results,
        "failures": failures,
    })
    history_path.write_text(json.dumps(history[-100:], indent=2))  # keep last 100

    return jsonify({
        "success": True,
        "data": {
            "interviews_count": len(all_results),
            "failures": failures,
            "result": {
                "interviews_count": len(all_results),
                "results": all_results,
            },
            "timestamp": now_iso(),
        },
    })


# ── Health check ──────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "mirofish-gemini", "model": GEMINI_MODEL, "time": now_iso()})


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5001))
    # Loopback by default. This is a private worker the Next.js app calls; it
    # has no reason to accept connections from the network, and binding 0.0.0.0
    # by default means one careless deployment exposes the model quota.
    host = os.getenv("MIROFISH_HOST", "127.0.0.1")

    print(f"[MiroFish Gemini Swarm] Starting on {host}:{port}")
    print(f"[MiroFish Gemini Swarm] Model: {GEMINI_MODEL}")
    print(f"[MiroFish Gemini Swarm] Data dir: {DATA_DIR.resolve()}")
    print(f"[MiroFish Gemini Swarm] CORS origin: {ALLOWED_ORIGIN}")
    print(f"[MiroFish Gemini Swarm] Auth: {'enabled' if SERVICE_TOKEN else 'NOT CONFIGURED (routes return 503)'}")
    if host != "127.0.0.1":
        print("[MiroFish] WARNING: binding a non-loopback address exposes this service")

    # Flask's development server is single-purpose and not built for untrusted
    # load. It is acceptable only because the service is loopback-only and
    # authenticated; a networked deployment must front it with a real WSGI server.
    app.run(host=host, port=port, debug=False, threaded=True)
