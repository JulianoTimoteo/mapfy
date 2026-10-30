import glob

for path in glob.glob("DashBoard/**/js/*.js", recursive=True):
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        c = f.read()
    if "doughnut" in c.lower():
        print("File:", path)
        for line in c.splitlines():
            if "doughnut" in line.lower() and ("type" in line.lower() or "new " in line.lower()):
                print("  ", line.strip()[:100])
