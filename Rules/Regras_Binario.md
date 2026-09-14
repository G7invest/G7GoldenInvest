# Regras Oficiais do Binário — G7 Gold Invest

> Documento de consulta permanente. Última atualização: Setembro/2026.
> Moeda base da plataforma: **USD (dólares americanos)**. Método de depósito/saque: **USDT (BEP-20 / TRC-20 / ERC-20) ou ETH**.

---

## 1. Modelo de Pagamento do Binário (ALVO da operação)

| Item | Valor / Regra |
|------|---------------|
| **Modo de pagamento** | **FIXO** (não é percentual) |
| **Valor por ciclo** | **US$ 10,00 fixos** |
| **Independência de volume** | O valor é sempre US$ 10,00 **independentemente do tamanho do volume na perna menor**. Um ciclo com US$ 1 de lado menor = US$ 10. Um ciclo com US$ 100.000 de lado menor = também US$ 10. |
| **Moeda** | USD (dólar americano) |

---

## 2. Estrutura da Árvore Binária

```
                    VOCÊ
                   /    \
              ESQUERDA   DIREITA
              /    \     /     \
            L1     L2   R1     R2
           / \    / \  / \    / \
          ...   ...   ...    ...
```

- **2 pernas obrigatórias**: Esquerda (Left) + Direita (Right).
- **Alocação BFS** (Busca em Largura — nível por nível) de acordo com o lado escolhido (Placement).
- **Build Leg**: cada patrocinador define o lado de construção. O lado oposto recebe o spillover (derramamento).

---

## 3. Qualificação para Receber o Binário

Para poder sacar o bônus binário você precisa estar **qualificado 1:1**:

✅ **1 usuário ATIVO na Esquerda**  
✅ **1 usuário ATIVO na Direita**

> Usuário ATIVO = realizou pelo menos 1 depósito/app ativa.  
> Falta de qualificação → bônus é pulado (`NOT_QUALIFIED`) e não é pago.

---

## 4. Cálculo do Ciclo Binário (Como funciona)

Sempre que houver pontos (volume) nas duas pernas:

1. Identifica `LesserLeg` = perna MENOR (menor volume entre esquerda e direita).
2. Se `LesserLeg > 0` e você está QUALIFICADO:
   - **Paga exatamente US$ 10,00** (FIXED) para o seu saldo de equipe.
3. Desconta o volume equivalente ao ciclo da **perna MAIOR** (maior lado) → estratégia `GREATER_LEG`.
4. O saldo da perna menor é ZERADO após o ciclo.
5. O volume residual da perna maior **fica como carryover** (carrega para o próximo ciclo).

### Exemplos práticos:

| Cenário | Esq | Dir | Lesser | Qualificado? | Pagamento | Saldo final Esq | Saldo final Dir |
|---------|-----|-----|--------|--------------|-----------|-----------------|-----------------|
| Ex. 1   | 30  | 100 | 30     | Sim          | US$ 10,00 | 0               | 100 - 30 = **70** |
| Ex. 2   | 500 | 120 | 120    | Sim          | US$ 10,00 | 500 - 120 = **380** | 0 |
| Ex. 3   | 5   | 8   | 5      | Não (falta 1 ativo em 1 perna) | **US$ 0,00** (pulado) | 5 | 8 |
| Ex. 4   | 0   | 120 | 0      | Sim          | **US$ 0,00** (sem dois lados) | 0 | 120 |

> Note: **não importa se a perna menor tem 1 ponto ou 1 milhão**, o pagamento do ciclo é sempre **US$ 10,00 fixos**.

---

## 5. Carryover (Volume que sobra)

- O carryover é **automático e permanente** (não expira).
- O sistema só "queima" (zera) a perna menor. A diferença da perna maior **fica acumulada** para o próximo ciclo.
- Estratégia: você só precisa de **1 volume novo na perna menor** para rodar outro ciclo de US$ 10,00 usando o carryover da perna maior.

---

## 6. Spillover (Derramamento)

O seu patrocinador (upline) pode "derramar" pessoas para DENTRO da sua árvore:

- Ocorre quando o upline coloca muitos indicados no mesmo lado (Build Leg).
- O lado oposto recebe automaticamente através de BFS nível abaixo de você.
- **Você também ganha binário com o spillover** (volume do derramamento conta na sua perna).

---

## 7. Tipos de Perna (Leg Type) na Árvore

| Tipo | O que significa |
|------|-----------------|
| **CONSTRUCTION (direto nível 1)** | Seu indicado DIRETO. Conta como qualificação 1:1 se ativo. Pontos SOBEM até você e param. |
| **SPILLOVER (derramamento)** | Indicado de alguém acima que caiu na sua árvore. Pontos SOBEM para TODOS os uplines (você incluso). |
| **QUALIFICATION** | Apenas marcação de qualificação (não gera pontos reais). |

---

## 8. Demais Bônus da Plataforma (resumo)

| Bônus | Valor / Regra |
|-------|---------------|
| **Indicação Direta** | 5% sobre TODO depósito do seu indicado DIRETO (nível 1). |
| **Binário** | **US$ 10,00 FIXOS por ciclo** (qualificação 1:1 exigida). |
| **Bônus 10 Indicações** | US$ 100,00 ao completar 10 indicados ATIVOS diretos. Meta: 10 ativos. Bônus: US$ 100. |
| **Rendimento Diário** | Passivo entre 0,8% e 2% ao dia (média 1,4%), **sem precisar indicar ninguém**. |
| **Ranks / Qualificação** | Bronze → Silver → Gold → Sapphire → Blue Sapphire → Diamond → Crown (Piscina Global 5% da receita). |

---

## 9. Investimento e Saques

| Item | Regra |
|------|-------|
| **Investimento Mínimo** | **US$ 100,00** (primeiro depósito para ativar). |
| **Saque Mínimo** | US$ 50,00 |
| **Taxa de Saque** | 5% fixa sobre o valor solicitado. |
| **Métodos de Depósito (Ativação)** | ✅ USDT (Rede BEP-20 / Binance Smart Chain) · ✅ USDT (Rede TRC-20 / Tron) · ✅ USDT (Rede ERC-20 / Ethereum) · ⚠️ **ETH NÃO para ativação inicial** |
| **Métodos de Saque** | ✅ USDT (Rede BEP-20 / Binance Smart Chain) · ✅ USDT (Rede TRC-20 / Tron) · ✅ USDT (Rede ERC-20 / Ethereum) · ✅ ETH (Ethereum) |
| **Método NÃO Aceito** | ❌ PIX · ❌ Boleto · ❌ Cartão · ❌ Transferência Bancária · ❌ ETH na ativação |
| **Tempo de Saque** | Até 24 horas úteis após aprovação. |

---

## 10. Contrato de Referência (Código Fonte)

Os valores acima estão sincronizados com `modules/core/contracts.js`:

```js
TEAM: {
  DIRECT_BONUS_PCT: 0.05,          // 5% indicação direta
  BINARY_PAYOUT_MODE: 'FIXED',     // ← FIXO (não percentual)
  BINARY_FIXED_PAYOUT: 10,         // ← US$ 10 por ciclo
  BINARY_DISCOUNT_FROM: 'GREATER_LEG',
  QUALIFICATION_REQUIRED: true,
  QUALIFICATION_REQUIRES_BOTH_LEGS: true,  // 1:1 (esq + dir)
  BONUS_10REF_AMOUNT: 100,          // US$ 100 para 10 indicações
  BONUS_10REF_TARGET: 10,
  MIN_APP_FOR_BONUS: 100            // US$ 100 app mínima
},
WALLET: {
  WITHDRAW_MIN: 50,
  WITHDRAW_FEE_PCT: 0.05,
  INVEST_MIN: 100                   // US$ 100 depósito inicial
}
```

---

## 11. Glossário Rápido

| Termo | Significado |
|-------|-------------|
| **Lesser Leg** | Perna menor (menor volume). |
| **Greater Leg** | Perna maior (maior volume) — recebe o desconto do ciclo. |
| **Carryover** | Volume "sobrando" que carrega para o próximo ciclo. |
| **Spillover** | Derramamento de upline. |
| **Qualificação 1:1** | 1 ativo esquerda + 1 ativo direita para liberar recebimento. |
| **Upline / Sponsor** | Seu patrocinador (quem indicou você). |
| **Downline** | Toda sua equipe abaixo na árvore. |
| **Placement** | Lado (esq/dir) escolhido pelo patrocinador ao inserir alguém. |
| **BEP-20** | Rede Binance Smart Chain (USDT). |
| **TRC-20** | Rede Tron (USDT). |
| **ERC-20** | Rede Ethereum (USDT e ETH). |

---

*Fim do documento. Manter este arquivo como SSOT (Single Source of Truth) para regras do binário G7 Gold Invest.*
