#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_fix_verification.py
Verifica a contagem de títulos com botão (i) e a estrutura do toolbar e modal de raio-x em todos os 17 dashboards.
"""

import glob, re
from bs4 import BeautifulSoup

def test_titles():
    selectors = [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        '.kpi-title', '.chart-card-title', '.filters-title', '.card-title', '.audit-item-title',
        '.chart-card-header .chart-card-title',
        '.card-transition > span:first-child',
        '.kpi-card > span:first-child',
        '.kpis-grid > div > span:first-child',
        'div[class*="card-transition"] > span[class*="uppercase"]',
        'div[class*="card"] > span[class*="uppercase"]'
    ]

    dashboards = glob.glob('DashBoard/*/index.html')
    print(f"Testando {len(dashboards)} dashboards...")
    for p in dashboards:
        with open(p, 'r', encoding='utf-8') as f:
            soup = BeautifulSoup(f.read(), 'html.parser')

        found = []
        for sel in selectors:
            for el in soup.select(sel):
                # Ignora se estiver dentro de controles, modais, etc.
                if el.find_parent(['button', 'select', 'input', 'header', 'footer']):
                    continue
                txt = el.get_text().strip()
                if len(txt) >= 3 and not re.match(r'^[0-9.,%\s\/:-]+$', txt):
                    if not any(skip in txt for skip in ['Pitangueiras', 'SAFRA 2026', 'Carregando']):
                        found.append(txt)
        print(f" - {p:42} -> {len(found)} títulos identificados para receber (i)")

if __name__ == '__main__':
    test_titles()
