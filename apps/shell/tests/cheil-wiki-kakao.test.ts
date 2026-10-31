/** Cheil fork: user consent gates Kakao delivery and connection never sends. */
import {it,expect,vi} from 'vitest'
const mocks=vi.hoisted(()=>({connect:vi.fn(),listTools:vi.fn(async()=>({tools:[{name:'KakaotalkChat-MemoChat',inputSchema:{properties:{message:{type:'string'}}}}]})),callTool:vi.fn(async()=>({isError:false})),close:vi.fn()}))
vi.mock('electron',()=>({safeStorage:{isEncryptionAvailable:()=>false}}))
vi.mock('@modelcontextprotocol/sdk/client/index.js',()=>({Client:class {connect=mocks.connect;listTools=mocks.listTools;callTool=mocks.callTool;close=mocks.close}}))
vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js',()=>({StreamableHTTPClientTransport:class {}}))
import {createWikiKakao} from '../src/main/cheil/wiki-kakao'
it('exchanges a token without sending and sends only explicitly approved text',async()=>{
 const future=new Date(Date.now()+3600000).toISOString()
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({accessToken:{tokenValue:'secret',expiresAt:future},refreshToken:{tokenValue:'refresh',expiresAt:future}})})))
 const run=createWikiKakao(()=> 'unused')
 expect(await run({op:'kakaoConnect',token:'oneTimeToken: ABCDEFGH123456'})).toMatchObject({ok:true,kakaoConnected:true})
 expect(mocks.callTool).not.toHaveBeenCalled()
 expect(await run({op:'kakaoSend',text:'업무 내용',approved:false})).toMatchObject({ok:false})
 expect(mocks.callTool).not.toHaveBeenCalled()
 expect(await run({op:'kakaoSend',text:'업무 내용',approved:true})).toMatchObject({ok:true})
 expect(mocks.callTool).toHaveBeenCalledWith({name:'KakaotalkChat-MemoChat',arguments:{message:'업무 내용'}})
 vi.unstubAllGlobals()
})
