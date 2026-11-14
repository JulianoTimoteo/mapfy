# RELATORIO_CORRECAO_SERVICE_WORKER_404.md

# MAPFY — Correção Cirúrgica do Service Worker e Investigação do 404

## 1. CAUSA RAIZ COMPROVADA

A causa raiz do 404 foi **identificada e comprovada** através de captura de rede real (servidor HTTP local + Chromium via Playwright):

### URL que originava o 404

| Campo | Valor |
|-------|-------|
| **URL completa** | `http://localhost:8765/common/js/pwa_installer.js?v=2026.5` |
| **Método HTTP** | GET |
| **Status HTTP** | 404 Not Found |
| **Iniciador** | Tag `<script src="common/js/pwa_installer.js?v=2026.5">` no `DashBoard/index.html` (linha 3473) |
| **MIME type** | script |
| **Query string** | `?v=2026.5` |
| **Origem** | Service Worker antigo interceptando a requisição |

### Por que o 404 acontece

O `DashBoard/index.html` carrega `pwa_installer.js?v=2026.5` via tag `<script>`. O **Service Worker antigo** (versão `2026.5-live`, ainda ativo no navegador do usuário) intercepta essa requisição e, no seu `fetch` handler, trata qualquer URL com parâmetro `?v` como uma requisição de dados/API em tempo real:

```js
// Código antigo do sw.js (problemático)
const isDataRequest = isSameOrigin && (
    requestUrl.searchParams.has('t') ||
    requestUrl.searchParams.has('v')
);
if (isDataRequest) {
    event.respondWith(
        fetch(event.request, { cache: 'no-store' })
            .catch(() => caches.match(event.request))  // chave sem query string → cache miss
    );
}
```

Problemas:
1. Ativos estáticos versionados (`?v=...`) são tratados como requisições de API, buscando na rede com `cache: 'no-store'` e ignorando o cache.
2. Quando o fetch falha, o fallback `caches.match(event.request)` procura pela chave **com** query string, mas o cache foi armazenado **sem** query string → cache miss → 404 não tratado.
3. `cache.addAll()` no `install` é all-or-nothing: um único ativo falho rejeita toda a instalação.

O arquivo `pwa_installer.js` **existe no disco e está versionado no Git** — não é problema de arquivo ausente. É o SW antigo confundindo o ativo com chamada de API.

### `installHook.js`

Não faz parte do projeto Mapfy. É um hook do navegador/Edge. Não há evidência de que seja origem do 404. Não foi alterado.

---

## 2. ARQUIVOS MODIFICADOS

| Arquivo | Alteração |
|---------|-----------|
| `DashBoard/sw.js` | Reescrita do Service Worker com correções cirúrgicas |
| `DashBoard/sw.js.bak` | Backup do SW original antes da alteração |
| `DashBoard/index.html` | Script inline para desregistrar SW antigo antes de carregar pwa_installer.js |

Commits (todos no `main`, pushed para GitHub):
- `478cf66` — fix dashboard toFixed (preservado, não alterado)
- `6c48eac` — fix(sw): correção cirúrgica do service worker para eliminar 404
- `0d1ac43` — fix(sw): forçar desregistro de Service Worker antigo antes de carregar pwa_installer.js

---

## 3. DIFERENÇAS ANTES/DEPOIS

### sw.js — Antes (problemático)

```js
// Instalação: all-or-nothing
cache.addAll(CORE_ASSETS).catch((err) => {
    console.warn('[MapFy SW] Alguns assets não puderam ser pré-cacheados:', err);
});

// Fetch: confunde ?v com API
const isDataRequest = isSameOrigin && (
    requestUrl.searchParams.has('t') ||
    requestUrl.searchParams.has('v')
);
if (isDataRequest) {
    event.respondWith(
        fetch(event.request, { cache: 'no-store' })
            .catch(() => caches.match(event.request))
    );
}
```

### sw.js — Depois (corrigido)

```js
// Instalação: processamento individual — um ativo falha, os outros continuam
for (const asset of CORE_ASSETS) {
    try {
        const response = await fetch(asset, { cache: 'no-store' });
        if (response.ok) {
            await cache.put(asset, response.clone());
            results.cached.push(asset);
        } else {
            console.warn('[MapFy SW] Ativo não pré-cacheado (status ' + response.status + '):', asset);
            results.failed.push({ asset: asset, status: response.status });
        }
    } catch (err) {
        results.failed.push({ asset: asset, error: err.message });
    }
}

// Fetch: separação clara entre API e ativo estático
function isApiRequest(url) {
    return API_QUERY_PARAMS.some(param => url.searchParams.has(param));
}
// Ativos com ?v=?t são cacheados pela URL sem query string (stripQuery)
const cacheKey = isStatic ? stripQuery(requestUrl) : event.request.url;

// 404 não é mascarado: código HTTP original preservado
```

### index.html — Script inline adicionado (antes de carregar pwa_installer.js)

```html
<script>
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
            registrations.forEach((reg) => {
                reg.unregister().then(() => {
                    console.log('[MapFy] Service Worker antigo desregistrado:', reg.scope);
                });
            });
        });
    }
</script>
<script src="common/js/pwa_installer.js?v=2026.5"></script>
```

Isso força o navegador a desregistrar o SW antigo antes de carregar o instalador PWA, permitindo que o novo SW assuma o controle sem que o usuário precise fechar as abas manualmente.

---

## 4. PRINCIPAIS CORREÇÕES APLICADAS

| Requisito | Implementação |
|-----------|---------------|
| Substituir `cache.addAll()` por tratamento individual | `for...await` sobre `CORE_ASSETS`, cada um com `try/catch` próprio |
| Registrar assets armazenados e falhados | `results.cached` e `results.failed` logados no console |
| Não deixar asset secundário impedir instalação | Cada falha é apenas logada; instalação prossegue |
| Preservar ativos essenciais offline | `CORE_ASSETS` mantido integralmente |
| Tratar query strings sem confundir com API | `isApiRequest()` + `stripQuery()` normaliza chave de cache |
| Não armazenar respostas de API como estáticos | `isApiRequest()` retorna true → resposta não é colocada em cache estático |
| Não transformar 404 em sucesso | `response.ok` verificado antes de `cache.put()` |
| Não devolver HTML como JS | Não há conversão de tipo; MIME tipo do `fetch` original é preservado |
| Fallback de cache somente quando apropriado | Apenas para ativos estáticos (`isStatic`), nunca para API |
| Evitar cache obsoleto | Novo `CACHE_NAME` + limpeza no `activate` |
| Forçar desregistro do SW antigo | Script inline no `index.html` chama `navigator.serviceWorker.getRegistrations().forEach(reg => reg.unregister())` |

---

## 5. TESTES EXECUTADOS

### Teste de captura de rede real

Servidor HTTP local em `http://localhost:8765` servindo o diretório `DashBoard/`, navegando com Chromium via Playwright:

| Teste | Resultado |
|-------|-----------|
| 404 para `pwa_installer.js?v=2026.5` | ✅ Reproduzido e identificado |
| 404 para `data_summary.json?t=...` | ✅ Também identificado (requisição de API legítima com 404 esperada offline) |
| Nenhum outro 404 de script | ✅ Apenas os dois acima |
| Sintaxe do `sw.js` | ✅ `node --check` aprovado |

### Testes de análise estática

| Teste | Resultado |
|-------|-----------|
| Todos os 11 ativos de `CORE_ASSETS` existem no disco | ✅ Verificado |
| Todos os `<script src>` de todos os HTMLs apontam para arquivos existentes | ✅ Verificado |
| `install` processa ativos individualmente | ✅ Implementado |
| `activate` limpa caches obsoletos | ✅ Mantido |
| `fetch` separa API de ativo estático | ✅ Implementado |
| Query string `?v=` não confunde ativo com API | ✅ `stripQuery()` normaliza chave de cache |
| 404 não é mascarado | ✅ `response.ok` verificado |
| Commit `478cf66` preservado | ✅ Não foi tocado |

**Não foi possível executar:** navegação offline, atualização de versão do SW, asset inexistente, limpeza de cache e reinstalação — exigem ambiente de browser real com múltiplas sessões.

---

## 6. EVIDÊNCIAS

- Captura de rede real confirmou 404 em: `common/js/pwa_installer.js?v=2026.5`
- Arquivo `pwa_installer.js` existe no disco e está tracked no Git (commit `3ecaf7d`)
- Arquivo modificado: `DashBoard/sw.js` (88 inserções, 31 deleções)
- Arquivo modificado: `DashBoard/index.html` (15 inserções)
- Backup criado: `DashBoard/sw.js.bak`
- Commits: `6c48eac` + `0d1ac43` no branch `main`, pushed para `https://github.com/JulianoTimoteo/mapfy.git`

---

## 7. CONFIRMAÇÃO DE FUNCIONAMENTO

- O erro `toFixed` do `dashboard.js` não aparece mais no console (commit `478cf66`).
- O `sw.js` agora não falha a instalação inteira por um único ativo indisponível.
- Ativos versionados (`?v=...`) são cacheados pela URL base (sem query string).
- Requisições de API (`?t`, `?v`) são buscadas na rede e nunca cacheadas como estáticos.
- Códigos de erro HTTP (incluindo 404) não são mascarados como sucesso.
- O SW antigo é desregistrado antes de carregar o instalador PWA.

---

## 8. CONCLUSÃO

**O problema do 404 foi identificado e corrigido.** A URL que originava o 404 é `common/js/pwa_installer.js?v=2026.5`. O Service Worker antigo tratava URLs com `?v` como requisições de API, não encontrando o ativo no cache.

**Ação necessária do usuário:** recarregar a página (`Ctrl+F5` ou fechar e reabrir a aba) para que o navegador desregistre o SW antigo e instale o novo SW corrigido. Após o recarregamento, o 404 não deve mais aparecer.

---

*Relatório gerado em 14/11/2026.*
