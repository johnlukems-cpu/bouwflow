"""Controleert of alle tabellen, kolommen en RPC-functies die de applicatie via
supabase-js gebruikt, bestaan in het gemigreerde databaseschema.
Gebruik: python3 scripts/check-db-contract.py <schema.json>  (zie scripts/test-db-contract.sh)"""
import json, re, sys, pathlib

schema = json.load(open(sys.argv[1]))
tables = {t: set(cols) for t, cols in schema["tables"].items()}
functions = {f["name"]: set(f["args"]) for f in schema["functions"]}
errors = []
src = "\n".join(p.read_text() for p in pathlib.Path("src").rglob("*.ts*") if "demo" not in p.parts)

for m in re.finditer(r'\.from\("([a-z_]+)"\)((?:[^;]|\n)*?)(?=;|\n\s*\n|\bconst\b|\breturn\b|\bif\b|\.from\(|\bsb\.|\bsupabase\.)', src):
    table, chain = m.group(1), m.group(2)
    if table == "documents" and ".storage" in src[max(0, m.start() - 20):m.start()]:
        continue
    if table not in tables:
        errors.append(f"onbekende tabel/view: {table}")
        continue
    cols = tables[table]
    for fn, col in re.findall(r'\.(eq|neq|in|order|is|gte|lte|gt|lt)\("([a-z_]+)"', chain):
        if col not in cols:
            errors.append(f"{table}.{col} (in .{fn}) bestaat niet")
    for sel in re.findall(r'\.select\(\s*[`"]([^`"]*)[`"]', chain):
        sel = re.sub(r"\$\{[A-Z_]+\}", "", sel)
        depth, buf, parts = 0, "", []
        for ch in sel:
            if ch == "(":
                depth += 1
            elif ch == ")":
                depth -= 1
            elif ch == "," and depth == 0:
                parts.append(buf); buf = ""; continue
            buf += ch
        parts.append(buf)
        for p in (x.strip() for x in parts):
            if not p or p == "*" or "(" in p:
                emb = re.match(r"(?:[a-z_]+:)?([a-z_]+)\(([^)]*)\)", p)
                if emb:
                    et, ecols = emb.group(1), [c.strip() for c in emb.group(2).split(",") if c.strip()]
                    if et not in tables:
                        errors.append(f"onbekende embed-tabel {et} in {table}")
                    else:
                        errors += [f"{et}.{c} (embed) bestaat niet" for c in ecols if c not in tables[et] and c != "*"]
                continue
            if p not in cols:
                errors.append(f"{table}.{p} (in select) bestaat niet")
    for obj in re.findall(r'\.(?:insert|update)\(\{([^}]*)\}', chain):
        for key in re.findall(r'(?:^|,|\n)\s*([a-z_]+)\s*:', obj):
            if key not in cols:
                errors.append(f"{table}.{key} (in insert/update) bestaat niet")

for m in re.finditer(r'rpc\(\s*"([a-z_]+)"(?:\s*,\s*\{([^}]*)\})?', src):
    name, args = m.group(1), m.group(2) or ""
    if name not in functions:
        errors.append(f"onbekende RPC-functie: {name}")
        continue
    for key in re.findall(r'([a-z_]+)\s*:', args):
        if key not in functions[name]:
            errors.append(f"RPC {name}: onbekend argument {key}")
for m in re.finditer(r'fn:\s*"([a-z_]+)",\s*args:\s*\{([^}]*)\}', src):
    name, args = m.group(1), m.group(2)
    if name not in functions:
        errors.append(f"onbekende RPC-functie: {name}")
        continue
    for key in re.findall(r'([a-z_]+)\s*:', args):
        if key not in functions[name]:
            errors.append(f"RPC {name}: onbekend argument {key}")

for e in sorted(set(errors)):
    print("✗", e)
print(f"{'✗' if errors else '✓'} databasecontract: {len(set(errors))} probleem/problemen")
sys.exit(1 if errors else 0)
