import { it,expect } from 'vitest'
import { codexQuotaWindows } from '../src/codex-quota'
import { recordAiRequest,recordAiTokens,localAiUsage,clearAiUsage } from '../src/usage-ledger'
it('reads modern buckets instead of double counting legacy and retains weekly reset',()=>{
 const rows=codexQuotaWindows({rateLimits:{primary:{usedPercent:99}},rateLimitsByLimitId:{codex:{primary:{usedPercent:23,windowDurationMins:300,resetsAt:1700000000},secondary:{usedPercent:42,windowDurationMins:10080,resetsAt:1700000100}},other:{primary:{usedPercent:5,windowDurationMins:60}}}})
 expect(rows).toHaveLength(3);expect(rows[1]).toMatchObject({minutes:10080,usedPercent:42,resetsAt:1700000100000});expect(rows[2].resetsAt).toBeNull()
})
it('does not turn missing or invalid usage into zero',()=>{expect(codexQuotaWindows({rateLimits:{primary:{usedPercent:null},secondary:{usedPercent:NaN}}})).toEqual([]);expect(codexQuotaWindows({rateLimits:{primary:{usedPercent:150}}})[0].usedPercent).toBe(100)})
it('counts measured tokens separately and returns immutable snapshots',()=>{clearAiUsage('openai');recordAiRequest('openai');recordAiTokens('openai',{inputTokens:12,outputTokens:8});const row=localAiUsage().find(r=>r.provider==='openai')!;expect(row).toMatchObject({requests:1,inputTokens:12,outputTokens:8,tokenReports:1});row.requests=99;expect(localAiUsage().find(r=>r.provider==='openai')!.requests).toBe(1);clearAiUsage('openai')})
