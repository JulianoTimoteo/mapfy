import glob

for path in glob.glob('DashBoard/**/index.html', recursive=True):
    if path.replace('\\', '/') == 'DashBoard/index.html':
        continue

    with open(path, 'r', encoding='utf-8') as f:
        c = f.read()

    if 'favicon.ico' in c:
        continue

    fav_tag = '    <link rel="shortcut icon" href="../favicon.ico" type="image/x-icon">\n    <link rel="icon" href="../favicon.ico" type="image/x-icon">\n'
    if '<meta name="viewport"' in c:
        c = c.replace('<meta name="viewport"', fav_tag + '    <meta name="viewport"', 1)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(c)
        print("Favicon added to:", path)
    else:
        print("Viewport not found in:", path)
