import { it,expect } from 'vitest'
import { mkdtemp,writeFile,readFile,mkdir,readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createFolderWork } from '../src/main/cheil/folder-work'
it('uses the per-job connection, isolates concurrent results and only saves new files',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'cheil-folder-'));await writeFile(join(dir,'source.md'),'original');await mkdir(join(dir,'nested'));await writeFile(join(dir,'nested','hidden.md'),'must not read')
 const seen:string[]=[];const work=createFolderWork({pick:async()=>dir,extract:async p=>({body:await readFile(p,'utf8')}),chat:async r=>{seen.push((r.settings as {provider:string}).provider);return {ok:true,content:r.user.split('\n')[0]}}})
 const picked=await work({op:'pick'});expect(picked.files).toEqual(['source.md']);expect(picked.text).toContain('original')
 const [a,b]=await Promise.all([work({op:'run',id:picked.id,query:'A',settings:{provider:'anthropic'}}),work({op:'run',id:picked.id,query:'B',settings:{provider:'gemini'}})])
 expect(seen).toEqual(['anthropic','gemini']);expect(a.text).toBe('A');expect(b.text).toBe('B')
 const saved=await work({op:'save',resultId:a.resultId});expect(saved.ok).toBe(true);expect(await readFile(saved.output!,'utf8')).toBe('A');expect(await readFile(join(dir,'source.md'),'utf8')).toBe('original');expect((await readdir(dir)).length).toBe(3)
 expect((await work({op:'save',resultId:a.resultId})).ok).toBe(false)
})
it('bounds previews and refuses invalid jobs without calling AI',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'cheil-folder-limit-'));for(let i=0;i<22;i++)await writeFile(join(dir,i+'.md'),'x')
 let calls=0;const work=createFolderWork({pick:async()=>dir,extract:async()=>({body:'x'}),chat:async()=>{calls++;return {ok:true,content:'x'}}})
 const picked=await work({op:'pick'});expect(picked.files?.length).toBe(20);expect(picked.skipped).toBe(2)
 expect((await work({op:'run',id:'invalid',query:'x'})).ok).toBe(false);expect(calls).toBe(0)
})
