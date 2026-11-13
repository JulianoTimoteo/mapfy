/**
 * test_broca_rules.js
 * Bateria de Testes Automatizados - Regras Agronômicas do Manual da Usina Pitangueiras
 * 
 * Validação rigorosa dos Testes A a J exigidos na especificação oficial:
 * - Teste A: 57 válidas, 18 positivas -> 31,58%, critério atingido (>= 30%).
 * - Teste B: 57 válidas, 17 positivas -> 29,82%, abaixo do critério (< 30%).
 * - Teste C: 57 válidas, 0 positivas -> 0%, abaixo do critério.
 * - Teste D: 57 registros, 10 instalações e 47 recolhimentos válidos -> Denominador = 47, nunca 57.
 * - Teste E: Recolhimento com 5 adultos -> abaixo do critério individual.
 * - Teste F: Recolhimento com 6 adultos -> no critério individual.
 * - Teste G: Recolhimento com quantidade ausente -> dado incompleto, não zero.
 * - Teste H: Registros duplicados da mesma armadilha e ciclo -> deduplicação e prevenção de dupla contagem.
 * - Teste I: Filtros de fazenda e talhão -> indicadores recalculados com o subconjunto correto.
 * - Teste J: Carga real da Usina Pitangueiras -> 116 registros, 57 recolhimentos, 34 positivas (59,65%), 906 brocas.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const baseDir = __dirname;
const engineCode = fs.readFileSync(path.join(baseDir, 'js', 'broca_engine.js'), 'utf8');
const dataCode = fs.readFileSync(path.join(baseDir, 'js', 'data.js'), 'utf8');
const shapesCode = fs.readFileSync(path.join(baseDir, '..', 'Maps', 'pitangueiras_shapes_data.js'), 'utf8');

const context = { window: {} };
context.window = context;
context.global = context;
vm.createContext(context);

vm.runInContext(engineCode, context);
vm.runInContext(dataCode, context);
vm.runInContext(shapesCode, context);

const BrocaEngine = context.window.BrocaEngine;
const rawData = context.window.BROCA_ARMADILHA_DATA;
const shapesData = context.window.PITANGUEIRAS_SHAPES_DATA;

console.log('==============================================================================');
console.log('🧪 BATERIA DE TESTES OFICIAIS: MANUAL TÉCNICO AGRONÔMICO (PÁG. 61 & 62)');
console.log('Usina Pitangueiras — Monitoramento de Broca por Armadilha');
console.log('==============================================================================\n');

// TESTE A: 57 válidas, 18 positivas. Esperado: 31,58%, critério atingido.
console.log('▶ Teste A: 57 válidas, 18 positivas...');
{
    const mockRecs = [];
    for (let i = 1; i <= 57; i++) {
        mockRecs.push({
            id: `TEST_A_${i}`,
            Etapa: 'RECOLHIMENTO',
            'Quantidade Machos': i <= 18 ? 6 : 2,
            Fazenda: '100',
            'Talhão': String(i),
            Data: '01/10/2026 10:00'
        });
    }
    const res = BrocaEngine.computeAgronomicIntelligence(mockRecs);
    assert.strictEqual(res.recolhimentosValidosCount, 57, 'Denominador deve ser 57');
    assert.strictEqual(res.armadilhasNoCriterioCount, 18, 'Numerador deve ser 18');
    assert.strictEqual(res.percentualNoCriterio, 31.58, 'Percentual esperado: 31.58%');
    assert.strictEqual(res.criterioAtingido, true, 'Critério deve ser atingido');
    console.log(`  ✅ Teste A APROVADO: ${res.armadilhasNoCriterioCount}/${res.recolhimentosValidosCount} = ${res.percentualFormatado} (Critério Atingido)`);
}

// TESTE B: 57 válidas, 17 positivas. Esperado: 29,82%, abaixo do critério.
console.log('\n▶ Teste B: 57 válidas, 17 positivas...');
{
    const mockRecs = [];
    for (let i = 1; i <= 57; i++) {
        mockRecs.push({
            id: `TEST_B_${i}`,
            Etapa: 'RECOLHIMENTO',
            'Quantidade Machos': i <= 17 ? 8 : 1,
            Fazenda: '100',
            'Talhão': String(i),
            Data: '01/10/2026 10:00'
        });
    }
    const res = BrocaEngine.computeAgronomicIntelligence(mockRecs);
    assert.strictEqual(res.recolhimentosValidosCount, 57, 'Denominador deve ser 57');
    assert.strictEqual(res.armadilhasNoCriterioCount, 17, 'Numerador deve ser 17');
    assert.strictEqual(res.percentualNoCriterio, 29.82, 'Percentual esperado: 29.82%');
    assert.strictEqual(res.criterioAtingido, false, 'Critério não deve ser atingido');
    console.log(`  ✅ Teste B APROVADO: ${res.armadilhasNoCriterioCount}/${res.recolhimentosValidosCount} = ${res.percentualFormatado} (Abaixo do Limite)`);
}

// TESTE C: 57 válidas, 0 positivas. Esperado: 0%, abaixo do critério.
console.log('\n▶ Teste C: 57 válidas, 0 positivas...');
{
    const mockRecs = [];
    for (let i = 1; i <= 57; i++) {
        mockRecs.push({
            id: `TEST_C_${i}`,
            Etapa: 'RECOLHIMENTO',
            'Quantidade Machos': 0,
            Fazenda: '100',
            'Talhão': String(i),
            Data: '01/10/2026 10:00'
        });
    }
    const res = BrocaEngine.computeAgronomicIntelligence(mockRecs);
    assert.strictEqual(res.recolhimentosValidosCount, 57);
    assert.strictEqual(res.armadilhasNoCriterioCount, 0);
    assert.strictEqual(res.percentualNoCriterio, 0.0);
    assert.strictEqual(res.criterioAtingido, false);
    console.log(`  ✅ Teste C APROVADO: ${res.armadilhasNoCriterioCount}/${res.recolhimentosValidosCount} = ${res.percentualFormatado}`);
}

// TESTE D: 57 registros, 10 instalações e 47 recolhimentos válidos. Denominador = 47, nunca 57.
console.log('\n▶ Teste D: 57 registros (10 instalações e 47 recolhimentos)...');
{
    const mockRecs = [];
    for (let i = 1; i <= 10; i++) {
        mockRecs.push({
            id: `INST_${i}`,
            Etapa: 'INSTALAÇÃO',
            'Quantidade Machos': 0,
            Fazenda: '100',
            'Talhão': String(i)
        });
    }
    for (let i = 1; i <= 47; i++) {
        mockRecs.push({
            id: `REC_${i}`,
            Etapa: 'RECOLHIMENTO',
            'Quantidade Machos': i <= 15 ? 10 : 2,
            Fazenda: '100',
            'Talhão': String(i)
        });
    }
    const res = BrocaEngine.computeAgronomicIntelligence(mockRecs);
    assert.strictEqual(mockRecs.length, 57, 'Total de lançamentos deve ser 57');
    assert.strictEqual(res.instalacoesCount, 10, 'Instalações deve ser 10');
    assert.strictEqual(res.recolhimentosValidosCount, 47, 'Denominador deve ser 47 (nunca 57)');
    console.log(`  ✅ Teste D APROVADO: Total lançamentos: 57 | Instalações: 10 | Denominador Válido: ${res.recolhimentosValidosCount}`);
}

// TESTE E: Recolhimento com 5 adultos. Esperado: abaixo do critério individual.
console.log('\n▶ Teste E: Recolhimento com 5 adultos...');
{
    const rec = BrocaEngine.normalizeRecord({
        id: '1',
        Etapa: 'RECOLHIMENTO',
        'Quantidade Machos': 5
    });
    assert.strictEqual(rec.atingiu_criterio_individual, false, '5 adultos deve ser abaixo do critério');
    console.log(`  ✅ Teste E APROVADO: 5 adultos -> atingiu_criterio_individual: ${rec.atingiu_criterio_individual}`);
}

// TESTE F: Recolhimento com 6 adultos. Esperado: no critério individual.
console.log('\n▶ Teste F: Recolhimento com 6 adultos...');
{
    const rec = BrocaEngine.normalizeRecord({
        id: '2',
        Etapa: 'RECOLHIMENTO',
        'Quantidade Machos': 6
    });
    assert.strictEqual(rec.atingiu_criterio_individual, true, '6 adultos deve atingir critério');
    console.log(`  ✅ Teste F APROVADO: 6 adultos -> atingiu_criterio_individual: ${rec.atingiu_criterio_individual}`);
}

// TESTE G: Recolhimento com quantidade ausente. Esperado: dado incompleto, não zero.
console.log('\n▶ Teste G: Recolhimento com quantidade ausente...');
{
    const rec = BrocaEngine.normalizeRecord({
        id: '3',
        Etapa: 'RECOLHIMENTO',
        'Quantidade Machos': null
    });
    assert.strictEqual(rec.dado_incompleto, true, 'Deve ser marcado como dado incompleto');
    assert.strictEqual(rec.machos_raw, null, 'machos_raw deve ser nulo, não zero');

    const res = BrocaEngine.computeAgronomicIntelligence([rec]);
    assert.strictEqual(res.recolhimentosValidosCount, 0, 'Recolhimento incompleto não entra no denominador');
    assert.strictEqual(res.excluidosCount, 1, 'Deve estar na lista de excluídos');
    console.log(`  ✅ Teste G APROVADO: Dado incompleto não vira zero e é excluído do denominador`);
}

// TESTE H: Registros duplicados da mesma armadilha e ciclo.
console.log('\n▶ Teste H: Registros duplicados...');
{
    const mockRecs = [
        { id: 'DUP_1', Etapa: 'RECOLHIMENTO', 'Quantidade Machos': 10, Fazenda: '100', 'Talhão': '1', Data: '01/10/2026 10:00' },
        { id: 'DUP_1', Etapa: 'RECOLHIMENTO', 'Quantidade Machos': 10, Fazenda: '100', 'Talhão': '1', Data: '01/10/2026 10:00' }
    ];
    const res = BrocaEngine.computeAgronomicIntelligence(mockRecs);
    assert.strictEqual(res.recolhimentosValidosCount, 1, 'Deve desconsiderar o segundo registro idêntico');
    assert.strictEqual(res.excluidosCount, 1, 'Registro duplicado deve constar nos excluídos com justificativa');
    console.log(`  ✅ Teste H APROVADO: Duplicação evitada (1 recolhimento válido, 1 excluído por duplicidade)`);
}

// TESTE I: Filtros de fazenda e talhão.
console.log('\n▶ Teste I: Filtros reativos por Fazenda e Talhão...');
{
    const filteredFaz40101 = BrocaEngine.filterRecords(rawData.map(BrocaEngine.normalizeRecord), { fazenda: '40101' });
    const resFaz = BrocaEngine.computeAgronomicIntelligence(filteredFaz40101, shapesData);
    assert.strictEqual(resFaz.recolhimentosValidosCount, 5, 'Fazenda 40101 possui 5 recolhimentos');
    assert.strictEqual(resFaz.armadilhasNoCriterioCount, 4, 'Fazenda 40101 possui 4 no critério');
    assert.strictEqual(resFaz.percentualNoCriterio, 80.0, 'Percentual: 80.0%');
    assert.strictEqual(resFaz.criterioAtingido, true, 'Fazenda 40101 deve atingir critério');
    console.log(`  ✅ Teste I APROVADO: Fazenda 40101 -> ${resFaz.armadilhasNoCriterioCount}/${resFaz.recolhimentosValidosCount} (${resFaz.percentualFormatado})`);
}

// TESTE J: Base Real Completa da Usina Pitangueiras.
console.log('\n▶ Teste J: Execução sobre a Base Real do Mapfy (116 registros)...');
{
    const resReal = BrocaEngine.computeAgronomicIntelligence(rawData, shapesData);
    assert.strictEqual(resReal.totalLancamentos, 116, 'Total de lançamentos deve ser 116');
    assert.strictEqual(resReal.instalacoesCount, 59, 'Instalações: 59');
    assert.strictEqual(resReal.recolhimentosValidosCount, 57, 'Recolhimentos válidos: 57');
    assert.strictEqual(resReal.armadilhasNoCriterioCount, 34, 'No critério (>=6 adultos): 34');
    assert.strictEqual(resReal.armadilhasAbaixoCriterioCount, 23, 'Abaixo do critério (<6 adultos): 23');
    assert.strictEqual(resReal.percentualNoCriterio, 59.65, 'Percentual real: 59.65%');
    assert.strictEqual(resReal.criterioAtingido, true, 'Critério atingido (>= 30%)');
    assert.strictEqual(resReal.totalBrocasCapturadas, 906, 'Total de brocas: 906');
    assert.strictEqual(resReal.areaTalhoesMonitoradosHa, 915.97, 'Área monitorada dos talhões: 915.97 ha');
    assert.strictEqual(resReal.areaTalhoesNoCriterioHa, 500.62, 'Área dos talhões com critério atingido: 500.62 ha');
    assert.strictEqual(resReal.coberturaNominalHa, 2850, 'Cobertura nominal: 2850 ha');

    console.log(`  ✅ Teste J APROVADO: Base Real 100% Homologada!`);
    console.log(`     - Total Lançamentos: ${resReal.totalLancamentos}`);
    console.log(`     - Instalações (início de ciclo): ${resReal.instalacoesCount}`);
    console.log(`     - Recolhimentos Válidos: ${resReal.recolhimentosValidosCount}`);
    console.log(`     - Armadilhas no Critério (>= 6 adultos): ${resReal.armadilhasNoCriterioCount}`);
    console.log(`     - Percentual de Infestação: ${resReal.percentualFormatado} (Limite: 30%) -> ${resReal.statusControle}`);
    console.log(`     - Total de Brocas: ${resReal.totalBrocasCapturadas}`);
    console.log(`     - Área Total dos Talhões: ${resReal.areaTalhoesMonitoradosHa} ha`);
    console.log(`     - Área dos Talhões no Critério: ${resReal.areaTalhoesNoCriterioHa} ha`);
    console.log(`     - Capacidade Nominal Teórica: ${resReal.coberturaNominalHa} ha (50 ha/armadilha)`);
}

console.log('\n==============================================================================');
console.log('🎉 100% DOS TESTES DO MANUAL TÉCNICO AGRONÔMICO APROVADOS COM SUCESSO!');
console.log('==============================================================================\n');
