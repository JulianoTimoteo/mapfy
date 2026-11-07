with open('DashBoard/subsolagem/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

target = 'id="osSortSelect"'
pos = text.find(target)
if pos != -1:
    # find preceding <div class="flex items-center gap-2 text-xs">
    pre = text.rfind('<div class="flex items-center gap-2 text-xs">', 0, pos)
    if pre != -1:
        text = text[:pre] + '<div class="flex flex-wrap items-center gap-2 text-xs">\n                    <div id="osFilterActiveContainer"></div>' + text[pre + len('<div class="flex items-center gap-2 text-xs">'):]
        with open('DashBoard/subsolagem/index.html', 'w', encoding='utf-8') as f:
            f.write(text)
        print('Updated subsolagem index.html successfully!')
    else:
        print('Preceding div not found')
else:
    print('osSortSelect not found')
